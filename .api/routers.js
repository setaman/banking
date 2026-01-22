
// Files Imports
import * as configure from "@api/configure";
import * as API_000 from "@api/root/src/api/dkb/transactions.ts";

// Public RESTful API Methods and Paths
// This section describes the available HTTP methods and their corresponding endpoints (paths).
// USE    /api/dkb/transactions    src/api/dkb/transactions.ts?fn=default
// USE    /api/dkb/transactions    src/api/dkb/transactions.ts?fn=AUTH
// USE    /api/dkb/transactions    src/api/dkb/transactions.ts?fn=CRUD
// USE    /api/dkb/transactions    src/api/dkb/transactions.ts?fn=USE
// GET    /api/dkb/transactions    src/api/dkb/transactions.ts?fn=PING
// GET    /api/dkb/transactions    src/api/dkb/transactions.ts?fn=GET
// POST   /api/dkb/transactions    src/api/dkb/transactions.ts?fn=POST
// POST   /api/dkb/transactions    src/api/dkb/transactions.ts?fn=ACTION
// PATCH  /api/dkb/transactions    src/api/dkb/transactions.ts?fn=PATCH
// PUT    /api/dkb/transactions    src/api/dkb/transactions.ts?fn=PUT
// DELETE /api/dkb/transactions    src/api/dkb/transactions.ts?fn=DELETE
// USE    /api/dkb/transactions    src/api/dkb/transactions.ts?fn=ERROR

const internal  = [
  API_000.default  && { cb: API_000.default , method: "use"    , route: "/dkb/transactions" , url: "/api/dkb/transactions" , source: "src/api/dkb/transactions.ts?fn=default" },
  API_000.AUTH     && { cb: API_000.AUTH    , method: "use"    , route: "/dkb/transactions" , url: "/api/dkb/transactions" , source: "src/api/dkb/transactions.ts?fn=AUTH"    },
  API_000.CRUD     && { cb: API_000.CRUD    , method: "use"    , route: "/dkb/transactions" , url: "/api/dkb/transactions" , source: "src/api/dkb/transactions.ts?fn=CRUD"    },
  API_000.USE      && { cb: API_000.USE     , method: "use"    , route: "/dkb/transactions" , url: "/api/dkb/transactions" , source: "src/api/dkb/transactions.ts?fn=USE"     },
  API_000.PING     && { cb: API_000.PING    , method: "get"    , route: "/dkb/transactions" , url: "/api/dkb/transactions" , source: "src/api/dkb/transactions.ts?fn=PING"    },
  API_000.GET      && { cb: API_000.GET     , method: "get"    , route: "/dkb/transactions" , url: "/api/dkb/transactions" , source: "src/api/dkb/transactions.ts?fn=GET"     },
  API_000.POST     && { cb: API_000.POST    , method: "post"   , route: "/dkb/transactions" , url: "/api/dkb/transactions" , source: "src/api/dkb/transactions.ts?fn=POST"    },
  API_000.ACTION   && { cb: API_000.ACTION  , method: "post"   , route: "/dkb/transactions" , url: "/api/dkb/transactions" , source: "src/api/dkb/transactions.ts?fn=ACTION"  },
  API_000.PATCH    && { cb: API_000.PATCH   , method: "patch"  , route: "/dkb/transactions" , url: "/api/dkb/transactions" , source: "src/api/dkb/transactions.ts?fn=PATCH"   },
  API_000.PUT      && { cb: API_000.PUT     , method: "put"    , route: "/dkb/transactions" , url: "/api/dkb/transactions" , source: "src/api/dkb/transactions.ts?fn=PUT"     },
  API_000.DELETE   && { cb: API_000.DELETE  , method: "delete" , route: "/dkb/transactions" , url: "/api/dkb/transactions" , source: "src/api/dkb/transactions.ts?fn=DELETE"  },
  API_000.ERROR    && { cb: API_000.ERROR   , method: "use"    , route: "/dkb/transactions" , url: "/api/dkb/transactions" , source: "src/api/dkb/transactions.ts?fn=ERROR"   }
].filter(it => it);

export const routers = internal.map((it) => {
  const { method, route, url, source } = it;
  return { method, url, route, source };
});

export const endpoints = internal.map(
  (it) => it.method?.toUpperCase() + "\t" + it.url
);

export const applyRouters = (applyRouter) => {
  internal.forEach((it) => {
    it.cb = configure.callbackBefore?.(it.cb, it) || it.cb;
    applyRouter(it);
  });
};

