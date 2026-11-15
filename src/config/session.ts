import session from "express-session";
import MongoStore from "connect-mongo";

import { config } from "./index";

const sessionMiddleware = session({
  name: "compiler.sid",

  secret: config.session.secret,

  resave: false,

  saveUninitialized: false,

  rolling: true,

  store: MongoStore.create({
    mongoUrl: config.database.uri,
    collectionName: "sessions",
    ttl: config.session.maxAge / 1000,
  }),

  cookie: {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    maxAge: config.session.maxAge,
  },
});

export default sessionMiddleware;
