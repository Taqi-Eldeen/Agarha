import { listingSchema, modelSchema } from '@agarha/schemas';
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';
import type { AuthContext } from '../../common/auth/auth-context';
import { AdminAuth, Auth, CurrentAuth, CurrentDealer } from '../../common/auth/guards';
import { Errors } from '../../common/errors';
import { Idempotent } from '../../common/idempotency';
import { ZodBody, ZodPipe, ZodQuery, ZodResponse } from '../../common/zod';
import { FLAGS, FlagsService } from '../../infra/flags';
import { CatalogService } from '../catalog';
import { ImportService } from './import.service';
import { adminListingQuerySchema, availabilitySchema, createListingSchema, fleetQuerySchema, moderationSchema, photoUploadSchema, reorderSchema, updateListingSchema, type CreateListing } from './listings.schemas';
import { ListingsService } from './listings.service';

type Dealer = { dealerId: string; userId: string; role: 'dealer_owner' | 'dealer_staff' };
const actor = (d: Dealer) => ({ userId: d.userId, role: d.role, dealerId: d.dealerId });

/** Staff can do everything on cars except archive; owners can do everything. */
@ApiTags('dealer')
@Controller('dealer/listings')
export class DealerListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly imports: ImportService,
    private readonly flags: FlagsService,
    private readonly catalog: CatalogService,
  ) {}

  @Get()
  @Auth('dealer', 'dealer_owner', 'dealer_staff')
  @ZodQuery(fleetQuerySchema)
  @ZodResponse(200, z.object({ items: z.array(listingSchema.extend({ model: modelSchema.extend({ makeSlug: z.string(), makeNameAr: z.string(), makeNameEn: z.string() }).nullable() })), nextCursor: z.string().nullable(), counts: z.record(z.string(), z.number()) }))
  fleet(@CurrentDealer() d: Dealer, @Query(new ZodPipe(fleetQuerySchema)) q: z.output<typeof fleetQuerySchema>) {
    return this.listings.fleet(d.dealerId, q);
  }

  @Post()
  @Auth('dealer', 'dealer_owner', 'dealer_staff')
  @Idempotent()
  @ZodBody(createListingSchema)
  @ZodResponse(201, listingSchema)
  create(@CurrentDealer() d: Dealer, @Body(new ZodPipe(createListingSchema)) b: CreateListing) {
    return this.listings.create(d.dealerId, b, actor(d));
  }

  @Post('confirm-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Bulk "still available": refresh every car in one tap.' })
  @Auth('dealer', 'dealer_owner', 'dealer_staff')
  confirmAll(@CurrentDealer() d: Dealer) {
    return this.listings.confirmAll(d.dealerId, actor(d));
  }

  @Post('import')
  @HttpCode(200)
  @ApiConsumes('text/csv')
  @ApiOperation({ summary: 'Phase 6 CSV import, step 1: validate (writes nothing).' })
  @Auth('dealer', 'dealer_owner')
  async importCsv(@CurrentDealer() d: Dealer, @Req() req: Request & { rawBody?: Buffer }) {
    if (!(await this.flags.isEnabled(FLAGS.csvImport))) throw Errors.notFound('Route');
    const csv = typeof req.body === 'string' ? req.body : (req.rawBody?.toString('utf8') ?? '');
    return this.imports.validate(d.dealerId, csv, actor(d));
  }

  @Post('import/:id/apply')
  @HttpCode(200)
  @Auth('dealer', 'dealer_owner')
  async applyImport(@CurrentDealer() d: Dealer, @Param('id', ParseUUIDPipe) id: string) {
    if (!(await this.flags.isEnabled(FLAGS.csvImport))) throw Errors.notFound('Route');
    return this.imports.apply(d.dealerId, id, actor(d));
  }

  @Get(':id')
  @Auth('dealer', 'dealer_owner', 'dealer_staff')
  async get(@CurrentDealer() d: Dealer, @Param('id', ParseUUIDPipe) id: string) {
    const l = await this.listings.one(id);
    if (l.dealerId !== d.dealerId) throw Errors.notFound('Listing');
    return { ...l, photos: await this.listings.photos(d.dealerId, id), model: await this.catalog.model(l.carModelId) };
  }

  @Put(':id')
  @Auth('dealer', 'dealer_owner', 'dealer_staff')
  @ZodBody(updateListingSchema)
  update(@CurrentDealer() d: Dealer, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(updateListingSchema)) b: CreateListing) {
    return this.listings.update(d.dealerId, id, b, actor(d));
  }

  @Post(':id/publish')
  @HttpCode(200)
  @Auth('dealer', 'dealer_owner', 'dealer_staff')
  publish(@CurrentDealer() d: Dealer, @Param('id', ParseUUIDPipe) id: string) {
    return this.listings.publish(d.dealerId, id, actor(d));
  }

  @Post(':id/pause')
  @HttpCode(200)
  @Auth('dealer', 'dealer_owner', 'dealer_staff')
  pause(@CurrentDealer() d: Dealer, @Param('id', ParseUUIDPipe) id: string) {
    return this.listings.setStatus(d.dealerId, id, 'paused', actor(d));
  }

  @Post(':id/archive')
  @HttpCode(200)
  @Auth('dealer', 'dealer_owner')
  archive(@CurrentDealer() d: Dealer, @Param('id', ParseUUIDPipe) id: string) {
    return this.listings.setStatus(d.dealerId, id, 'archived', actor(d));
  }

  @Put(':id/availability')
  @ApiOperation({ summary: 'One-tap availability switch (also confirms freshness). Client updates optimistically with undo.' })
  @Auth('dealer', 'dealer_owner', 'dealer_staff')
  @ZodBody(availabilitySchema)
  availability(@CurrentDealer() d: Dealer, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(availabilitySchema)) b: z.output<typeof availabilitySchema>) {
    return this.listings.setAvailability(d.dealerId, id, b.available, actor(d));
  }

  @Get(':id/photos')
  @Auth('dealer', 'dealer_owner', 'dealer_staff')
  async photos(@CurrentDealer() d: Dealer, @Param('id', ParseUUIDPipe) id: string) {
    return { items: await this.listings.photos(d.dealerId, id) };
  }

  @Post(':id/photos')
  @ApiOperation({ summary: 'Presigned PUT for one photo (type and size locked). Max 12 per car, 10 MB each.' })
  @Auth('dealer', 'dealer_owner', 'dealer_staff')
  @Idempotent()
  @ZodBody(photoUploadSchema)
  photoUpload(@CurrentDealer() d: Dealer, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(photoUploadSchema)) b: z.output<typeof photoUploadSchema>) {
    return this.listings.createPhotoUpload(d.dealerId, id, b);
  }

  @Post(':id/photos/:photoId/complete')
  @HttpCode(200)
  @Auth('dealer', 'dealer_owner', 'dealer_staff')
  completePhoto(@CurrentDealer() d: Dealer, @Param('id', ParseUUIDPipe) id: string, @Param('photoId', ParseUUIDPipe) photoId: string) {
    return this.listings.completePhoto(d.dealerId, id, photoId);
  }

  @Put(':id/photos/order')
  @Auth('dealer', 'dealer_owner', 'dealer_staff')
  @ZodBody(reorderSchema)
  async reorder(@CurrentDealer() d: Dealer, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(reorderSchema)) b: z.output<typeof reorderSchema>) {
    return { items: await this.listings.reorderPhotos(d.dealerId, id, b.photoIds) };
  }

  @Delete(':id/photos/:photoId')
  @HttpCode(204)
  @Auth('dealer', 'dealer_owner', 'dealer_staff')
  async deletePhoto(@CurrentDealer() d: Dealer, @Param('id', ParseUUIDPipe) id: string, @Param('photoId', ParseUUIDPipe) photoId: string) {
    await this.listings.deletePhoto(d.dealerId, id, photoId);
  }
}

@ApiTags('admin')
@Controller('admin/listings')
export class AdminListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  @AdminAuth('admin', 'moderator')
  @ZodQuery(adminListingQuerySchema)
  queue(@Query(new ZodPipe(adminListingQuerySchema)) q: z.output<typeof adminListingQuerySchema>) {
    return this.listings.adminQueue(q);
  }

  @Post(':id/moderate')
  @HttpCode(200)
  @AdminAuth('admin', 'moderator')
  @ZodBody(moderationSchema)
  moderate(@CurrentAuth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(moderationSchema)) b: z.output<typeof moderationSchema>) {
    return this.listings.moderate(id, b, { userId: a.userId, role: a.roles.includes('admin') ? 'admin' : 'moderator' });
  }

  /** A4: ops staff create listings on a dealer's behalf (audited as the staff member). */
  @Post('on-behalf/:dealerId')
  @AdminAuth('admin', 'support')
  @Idempotent()
  @ZodBody(createListingSchema)
  onBehalf(@CurrentAuth() a: AuthContext, @Param('dealerId', ParseUUIDPipe) dealerId: string, @Body(new ZodPipe(createListingSchema)) b: CreateListing) {
    return this.listings.create(dealerId, b, { userId: a.userId, role: a.roles.includes('admin') ? 'admin' : 'support' });
  }

  @Post('on-behalf/:dealerId/:id/publish')
  @HttpCode(200)
  @AdminAuth('admin', 'support')
  publishOnBehalf(@CurrentAuth() a: AuthContext, @Param('dealerId', ParseUUIDPipe) dealerId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.listings.publish(dealerId, id, { userId: a.userId, role: a.roles.includes('admin') ? 'admin' : 'support' });
  }
}

@ApiTags('favorites')
@Controller('me/favorites')
export class FavoritesController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  @Auth('customer')
  async list(@CurrentAuth() a: AuthContext) {
    const ids = await this.listings.favorites(a.userId);
    return { listingIds: ids };
  }

  @Put(':listingId')
  @HttpCode(204)
  @Auth('customer')
  async add(@CurrentAuth() a: AuthContext, @Param('listingId', ParseUUIDPipe) id: string) {
    await this.listings.addFavorite(a.userId, id);
  }

  @Delete(':listingId')
  @HttpCode(204)
  @Auth('customer')
  async remove(@CurrentAuth() a: AuthContext, @Param('listingId', ParseUUIDPipe) id: string) {
    await this.listings.removeFavorite(a.userId, id);
  }
}
