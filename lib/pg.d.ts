declare module 'pg' {
  export type QueryResult = {rows:Record<string,unknown>[];rowCount:number|null};
  export type PoolClient = {
    query(sql:string,values?:unknown[]):Promise<QueryResult>;
    release(destroy?:boolean):void;
  };
  export class Pool {
    constructor(options:{connectionString:string;max?:number;connectionTimeoutMillis?:number;idleTimeoutMillis?:number;allowExitOnIdle?:boolean});
    connect():Promise<PoolClient>;
    end():Promise<void>;
    on(event:'error',listener:(error:Error)=>void):this;
  }
}
