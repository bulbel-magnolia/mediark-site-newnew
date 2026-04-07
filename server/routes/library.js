import express from "express";

import { listLibraryWorks } from "../lib/work-service.js";

export function createLibraryRouter({ db }) {
  const router = express.Router();

  router.get("/works", (_req, res) => {
    res.json({ items: listLibraryWorks(db) });
  });

  return router;
}
