import {
  CAR_BODY_TYPES,
  areaSchema as areaOut,
  citySchema as cityOut,
  makeSchema as makeOut,
  modelSchema as modelOut,
} from '@agarha/schemas';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CacheControlInterceptor, PublicCache } from '../../common/cache';
import { AdminAuth, CurrentAuth } from '../../common/auth/guards';
import type { AuthContext } from '../../common/auth/auth-context';
import { ZodBody, ZodPipe, ZodResponse } from '../../common/zod';
import { AuditService } from '../admin';
import { CatalogService } from './catalog.service';

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(60);
const names = {
  nameAr: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().min(1).max(80),
};
const geo = {
  lat: z.number().min(21).max(32).nullable().optional(),
  lng: z.number().min(24).max(37).nullable().optional(),
};
const citySchema = z.object({
  slug,
  ...names,
  isActive: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  ...geo,
});
const areaSchema = z.object({ cityId: z.uuid(), slug, ...names, ...geo });
const makeSchema = z.object({ slug, ...names });
const modelSchema = z.object({
  makeId: z.uuid(),
  slug,
  ...names,
  bodyType: z.enum(CAR_BODY_TYPES),
});
const trimSchema = z.object({ modelId: z.uuid(), slug, ...names });

@ApiTags('catalog')
@UseInterceptors(CacheControlInterceptor)
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('cities')
  @PublicCache(300)
  @ZodResponse(200, z.object({ items: z.array(cityOut) }))
  async cities() {
    return { items: await this.catalog.cities() };
  }

  @Get('cities/:slug')
  @PublicCache(300)
  @ZodResponse(200, cityOut.extend({ areas: z.array(areaOut) }))
  async city(@Param('slug') slugParam: string) {
    const city = await this.catalog.cityBySlug(slugParam);
    return { ...city, areas: await this.catalog.areas(city.id) };
  }

  @Get('makes')
  @PublicCache(300)
  @ZodResponse(200, z.object({ items: z.array(makeOut) }))
  async makes() {
    return { items: await this.catalog.makes() };
  }

  @Get('makes/:id/models')
  @PublicCache(300)
  @ZodResponse(200, z.object({ items: z.array(modelOut) }))
  async models(@Param('id', ParseUUIDPipe) id: string) {
    return { items: await this.catalog.models(id) };
  }

  @Get('models/:id/trims')
  @PublicCache(300)
  async trims(@Param('id', ParseUUIDPipe) id: string) {
    return { items: await this.catalog.trims(id) };
  }

  @Get('body-types')
  @PublicCache(3600)
  bodyTypes() {
    return { items: CAR_BODY_TYPES };
  }

  @Get('suggest')
  @PublicCache(60)
  suggest(@Query('q') q = '') {
    return this.catalog.suggest(q.slice(0, 60));
  }
}

@ApiTags('admin')
@Controller('admin/catalog')
export class AdminCatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly audit: AuditService,
  ) {}

  private async log(auth: AuthContext, action: string, id: string | undefined, metadata: object) {
    await this.audit.record({
      actorUserId: auth.userId,
      actorRole: 'admin',
      action,
      targetType: 'catalog',
      targetId: id ?? null,
      metadata: metadata as Record<string, unknown>,
    });
  }

  @Get('cities')
  @AdminAuth('admin', 'moderator', 'support')
  async cities() {
    return { items: await this.catalog.cities(true) };
  }

  @Post('cities')
  @AdminAuth('admin')
  @ZodBody(citySchema)
  async createCity(
    @CurrentAuth() a: AuthContext,
    @Body(new ZodPipe(citySchema)) b: z.output<typeof citySchema>,
  ) {
    const r = await this.catalog.upsertCity(b);
    await this.log(a, 'catalog.city.create', r?.id, b);
    return r;
  }

  @Put('cities/:id')
  @AdminAuth('admin')
  @ZodBody(citySchema)
  async updateCity(
    @CurrentAuth() a: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(citySchema)) b: z.output<typeof citySchema>,
  ) {
    const r = await this.catalog.upsertCity({ ...b, id });
    await this.log(a, 'catalog.city.update', id, b);
    return r;
  }

  @Post('areas')
  @AdminAuth('admin')
  @ZodBody(areaSchema)
  async createArea(
    @CurrentAuth() a: AuthContext,
    @Body(new ZodPipe(areaSchema)) b: z.output<typeof areaSchema>,
  ) {
    const r = await this.catalog.upsertArea(b);
    await this.log(a, 'catalog.area.create', r?.id, b);
    return r;
  }

  @Put('areas/:id')
  @AdminAuth('admin')
  @ZodBody(areaSchema)
  async updateArea(
    @CurrentAuth() a: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(areaSchema)) b: z.output<typeof areaSchema>,
  ) {
    const r = await this.catalog.upsertArea({ ...b, id });
    await this.log(a, 'catalog.area.update', id, b);
    return r;
  }

  @Post('makes')
  @AdminAuth('admin')
  @ZodBody(makeSchema)
  async createMake(
    @CurrentAuth() a: AuthContext,
    @Body(new ZodPipe(makeSchema)) b: z.output<typeof makeSchema>,
  ) {
    const r = await this.catalog.upsertMake(b);
    await this.log(a, 'catalog.make.create', r?.id, b);
    return r;
  }

  @Put('makes/:id')
  @AdminAuth('admin')
  @ZodBody(makeSchema)
  async updateMake(
    @CurrentAuth() a: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(makeSchema)) b: z.output<typeof makeSchema>,
  ) {
    const r = await this.catalog.upsertMake({ ...b, id });
    await this.log(a, 'catalog.make.update', id, b);
    return r;
  }

  @Post('models')
  @AdminAuth('admin')
  @ZodBody(modelSchema)
  async createModel(
    @CurrentAuth() a: AuthContext,
    @Body(new ZodPipe(modelSchema)) b: z.output<typeof modelSchema>,
  ) {
    const r = await this.catalog.upsertModel(b);
    await this.log(a, 'catalog.model.create', r?.id, b);
    return r;
  }

  @Put('models/:id')
  @AdminAuth('admin')
  @ZodBody(modelSchema)
  async updateModel(
    @CurrentAuth() a: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(modelSchema)) b: z.output<typeof modelSchema>,
  ) {
    const r = await this.catalog.upsertModel({ ...b, id });
    await this.log(a, 'catalog.model.update', id, b);
    return r;
  }

  @Post('trims')
  @AdminAuth('admin')
  @ZodBody(trimSchema)
  async createTrim(
    @CurrentAuth() a: AuthContext,
    @Body(new ZodPipe(trimSchema)) b: z.output<typeof trimSchema>,
  ) {
    const r = await this.catalog.upsertTrim(b);
    await this.log(a, 'catalog.trim.create', r?.id, b);
    return r;
  }
}
