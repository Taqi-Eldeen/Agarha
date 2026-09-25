// Cross-module ports resolved by token, for questions whose answer lives in a module that
// would otherwise create an import cycle. The owning module provides the implementation.

/** Provided by listings: does a branch still have non-archived cars? (asked by dealers) */
export const BRANCH_LISTINGS_CHECK = Symbol('BRANCH_LISTINGS_CHECK');
export type BranchListingsCheck = (branchId: string) => Promise<boolean>;
