// PDPL export/delete. Each module registers what it holds about a user; identity orchestrates.
import { Global, Injectable, Module } from '@nestjs/common';

export interface PrivacyContributor {
  /** Section name in the export, e.g. "leads". */
  name: string;
  export(userId: string): Promise<unknown>;
  /** Delete or anonymise this module's personal data for the user. */
  erase(userId: string): Promise<void>;
}

@Injectable()
export class PrivacyRegistry {
  private readonly contributors: PrivacyContributor[] = [];
  register(c: PrivacyContributor): void {
    this.contributors.push(c);
  }
  list(): readonly PrivacyContributor[] {
    return this.contributors;
  }
}

@Global()
@Module({ providers: [PrivacyRegistry], exports: [PrivacyRegistry] })
export class PrivacyModule {}
