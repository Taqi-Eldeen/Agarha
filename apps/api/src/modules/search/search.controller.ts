import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthContext } from '../../common/auth/auth-context';
import { Auth, CurrentAuth } from '../../common/auth/guards';
import { CacheControlInterceptor, PublicCache } from '../../common/cache';
import { Client, type ClientInfo } from '../../common/request';
import { ZodBody, ZodPipe, ZodQuery } from '../../common/zod';
import { DealersService } from '../dealers';
import { ReviewsService } from '../reviews';
import { savedSearchPatchSchema, savedSearchSchema, searchQuerySchema, type SearchQuery } from './search.schemas';
import { SearchService } from './search.service';

const directoryQuery = z.object({ city: z.string().max(60).optional(), cursor: z.string().max(200).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });
const pageQuery = z.object({ cursor: z.string().max(300).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });
const landingQuery = z.object({ area: z.string().max(60).optional(), type: z.string().max(30).optional() });

/** Public read side. Edge-cached for 60s (section 6). No bulk export endpoint exists (risk #9). */
@ApiTags('public')
@UseInterceptors(CacheControlInterceptor)
@Controller()
export class PublicController {
  constructor(
    private readonly search: SearchService,
    private readonly dealers: DealersService,
    private readonly reviews: ReviewsService,
  ) {}

  @Get('search')
  @PublicCache(60)
  @ApiOperation({ summary: 'Search live listings. Cursor-paginated, max 50 per page.' })
  @ZodQuery(searchQuerySchema)
  find(@Query(new ZodPipe(searchQuerySchema)) q: SearchQuery) {
    return this.search.search(q);
  }

  @Get('search/map')
  @PublicCache(60)
  @ApiOperation({ summary: 'Map pins (max 500) for a bounding box; the client clusters them.' })
  @ZodQuery(searchQuerySchema)
  map(@Query(new ZodPipe(searchQuerySchema)) q: SearchQuery) {
    return this.search.pins(q);
  }

  @Get('listings/:id')
  @PublicCache(60)
  detail(@Param('id', ParseUUIDPipe) id: string, @Client() c: ClientInfo) {
    return this.search.listingDetail(id, `${c.ip ?? ''}|${c.userAgent ?? ''}`);
  }

  @Get('dealers')
  @PublicCache(60)
  @ZodQuery(directoryQuery)
  async directory(@Query(new ZodPipe(directoryQuery)) q: z.output<typeof directoryQuery>) {
    const page = await this.dealers.directory(q);
    const summaries = await this.reviews.summaries(page.items.map((d) => d.id));
    return {
      items: page.items.map((d) => ({ id: d.id, slug: d.slug, nameAr: d.displayNameAr, nameEn: d.displayNameEn, verified: true, branchCount: d.branchCount, reviews: summaries.get(d.id) ?? { count: 0, average: null } })),
      nextCursor: page.nextCursor,
    };
  }

  @Get('dealers/:slug')
  @PublicCache(60)
  profile(@Param('slug') slug: string) {
    return this.search.dealerProfile(slug);
  }

  @Get('dealers/:slug/reviews')
  @PublicCache(60)
  @ZodQuery(pageQuery)
  async dealerReviews(@Param('slug') slug: string, @Query(new ZodPipe(pageQuery)) q: z.output<typeof pageQuery>) {
    const profile = await this.search.dealerProfile(slug);
    return this.reviews.publicForDealer(profile.dealer.id, q);
  }

  @Get('landing/:city')
  @PublicCache(300)
  @ZodQuery(landingQuery)
  landing(@Param('city') city: string, @Query(new ZodPipe(landingQuery)) q: z.output<typeof landingQuery>) {
    return this.search.landing(city, { ...(q.area ? { area: q.area } : {}), ...(q.type ? { type: q.type } : {}) });
  }

  @Get('seo/sitemap')
  @PublicCache(600)
  sitemap() {
    return this.search.sitemap();
  }
}

@ApiTags('saved')
@Controller('me')
export class SavedController {
  constructor(private readonly search: SearchService) {}

  @Get('favorites/cards')
  @Auth('customer')
  favorites(@CurrentAuth() a: AuthContext) {
    return this.search.favoritesCards(a.userId);
  }

  @Get('saved-searches')
  @Auth('customer')
  async list(@CurrentAuth() a: AuthContext) {
    return { items: await this.search.listSaved(a.userId) };
  }

  @Post('saved-searches')
  @Auth('customer')
  @ZodBody(savedSearchSchema)
  create(@CurrentAuth() a: AuthContext, @Body(new ZodPipe(savedSearchSchema)) b: z.output<typeof savedSearchSchema>) {
    return this.search.createSaved(a.userId, b);
  }

  @Patch('saved-searches/:id')
  @Auth('customer')
  @ZodBody(savedSearchPatchSchema)
  update(@CurrentAuth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(savedSearchPatchSchema)) b: z.output<typeof savedSearchPatchSchema>) {
    return this.search.updateSaved(a.userId, id, b);
  }

  @Delete('saved-searches/:id')
  @HttpCode(204)
  @Auth('customer')
  async remove(@CurrentAuth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.search.deleteSaved(a.userId, id);
  }
}
