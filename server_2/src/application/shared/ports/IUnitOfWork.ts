export interface IUnitOfWork {
  runInTransaction<T>(work: (ctx: unknown) => Promise<T>): Promise<T>;
}
