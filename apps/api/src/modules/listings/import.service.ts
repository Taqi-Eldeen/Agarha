import {
  DRIVER_OPTIONS,
  FUELS,
  REQUIRED_DOCS,
  TRANSMISSIONS,
  normalizeArabic,
} from '@agarha/schemas';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { parse } from 'csv-parse/sync';
import { Errors } from '../../common/errors';
import { DB, type Database } from '../../db/db';
import { listingImports } from '../../db/schema/listings';
import { CatalogService } from '../catalog';
import { DealersService } from '../dealers';
import { createListingSchema } from './listings.schemas';
import { ListingsService, type Actor } from './listings.service';

/** Columns of the CSV template (docs/dealer-csv-template.csv). */
export const CSV_COLUMNS = [
  'make',
  'model',
  'year',
  'color',
  'transmission',
  'fuel',
  'seats',
  'driver_option',
  'price_day',
  'price_week',
  'price_month',
  'deposit',
  'min_age',
  'required_docs',
  'km_limit_per_day',
  'airport_pickup',
  'branch',
] as const;
const MAX_ROWS = 200;

type Row = Record<(typeof CSV_COLUMNS)[number], string>;
interface ImportError {
  row: number;
  field: string;
  code: string;
}

/** Phase 6: bulk fleet import. Validate first (nothing is written), then apply as drafts. */
@Injectable()
export class ImportService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly catalog: CatalogService,
    private readonly dealers: DealersService,
    private readonly listings: ListingsService,
  ) {}

  private async resolveModel(make: string, model: string) {
    const makes = await this.catalog.makes();
    const nm = normalizeArabic(make);
    const mk = makes.find(
      (m) => normalizeArabic(m.nameEn) === nm || normalizeArabic(m.nameAr) === nm || m.slug === nm,
    );
    if (!mk) return null;
    const models = await this.catalog.models(mk.id);
    const nmod = normalizeArabic(model);
    return (
      models.find(
        (m) =>
          normalizeArabic(m.nameEn) === nmod ||
          normalizeArabic(m.nameAr) === nmod ||
          m.slug === nmod,
      ) ?? null
    );
  }

  async validate(dealerId: string, csv: string, actor: Actor) {
    let rows: Row[];
    try {
      rows = parse(csv, {
        columns: (h: string[]) => h.map((c) => c.trim().toLowerCase()),
        skip_empty_lines: true,
        trim: true,
        bom: true,
      }) as Row[];
    } catch {
      throw Errors.badRequest('validation_failed', 'Could not read the CSV file');
    }
    if (!rows.length) throw Errors.badRequest('validation_failed', 'The file has no rows');
    if (rows.length > MAX_ROWS)
      throw Errors.badRequest('validation_failed', `At most ${MAX_ROWS} cars per file`);
    const branches = await this.dealers.branches(dealerId);
    const errors: ImportError[] = [];
    const valid: unknown[] = [];
    for (const [i, r] of rows.entries()) {
      const rowNo = i + 2;
      const model = await this.resolveModel(r.make ?? '', r.model ?? '');
      if (!model) {
        errors.push({ row: rowNo, field: 'model', code: 'unknown_model' });
        continue;
      }
      const branch = r.branch
        ? branches.find(
            (b) =>
              normalizeArabic(b.nameEn) === normalizeArabic(r.branch) ||
              normalizeArabic(b.nameAr) === normalizeArabic(r.branch),
          )
        : branches.find((b) => b.isPrimary);
      if (!branch) {
        errors.push({ row: rowNo, field: 'branch', code: 'unknown_branch' });
        continue;
      }
      const num = (v: string | undefined) =>
        v === undefined || v === '' ? undefined : Number(v.replace(/[,\s]/g, ''));
      const candidate = {
        carModelId: model.id,
        branchId: branch.id,
        year: num(r.year),
        color: r.color,
        transmission: r.transmission?.toLowerCase(),
        fuel: r.fuel?.toLowerCase(),
        seats: num(r.seats),
        driverOption: r.driver_option?.toLowerCase(),
        priceDayEgp: num(r.price_day),
        priceWeekEgp: num(r.price_week),
        priceMonthEgp: num(r.price_month),
        depositEgp: num(r.deposit),
        minAge: num(r.min_age),
        requiredDocs: (r.required_docs ?? '')
          .split(/[|;]/)
          .map((d) => d.trim())
          .filter(Boolean),
        kmLimitPerDay: r.km_limit_per_day ? num(r.km_limit_per_day) : null,
        airportPickup: ['yes', 'true', '1', 'نعم'].includes((r.airport_pickup ?? '').toLowerCase()),
      };
      const parsed = createListingSchema.safeParse(candidate);
      if (!parsed.success)
        for (const issue of parsed.error.issues)
          errors.push({ row: rowNo, field: String(issue.path[0] ?? 'row'), code: issue.message });
      else valid.push(parsed.data);
    }
    const [imp] = await this.db
      .insert(listingImports)
      .values({
        dealerId,
        createdBy: actor.userId,
        status: errors.length ? 'failed' : 'ready',
        rowCount: rows.length,
        errors,
        rows: errors.length ? null : valid,
      })
      .returning();
    return {
      importId: imp!.id,
      status: imp!.status,
      rowCount: rows.length,
      errors,
      allowed: {
        transmission: TRANSMISSIONS,
        fuel: FUELS,
        driver_option: DRIVER_OPTIONS,
        required_docs: REQUIRED_DOCS,
      },
    };
  }

  async apply(dealerId: string, importId: string, actor: Actor) {
    const [imp] = await this.db
      .select()
      .from(listingImports)
      .where(and(eq(listingImports.id, importId), eq(listingImports.dealerId, dealerId)));
    if (!imp) throw Errors.notFound('Import');
    if (imp.status !== 'ready') throw Errors.conflict('This import cannot be applied');
    const rows = imp.rows ?? [];
    const created: string[] = [];
    for (const r of rows)
      created.push((await this.listings.create(dealerId, r as never, actor)).id);
    await this.db
      .update(listingImports)
      .set({ status: 'applied', appliedAt: new Date(), rows: null })
      .where(eq(listingImports.id, importId));
    return { created: created.length, listingIds: created };
  }
}
