/**
 * @fileoverview Documents API routes
 */

import { zValidator } from "@hono/zod-validator";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";

import { documents } from "@/db/index";
import { authMiddleware } from "../middleware/auth";

const documentsRouter = new Hono<{ Bindings: Env }>();

// Apply auth middleware
documentsRouter.use("*", authMiddleware);

const createDocumentSchema = z.object({
  title: z.string().min(1),
  content: z.string(), // JSON string of document content
});

// GET /api/documents
documentsRouter.get("/", async (c) => {
  const db = drizzle(c.env.DB);

  try {
    const allDocuments = await db
      .select()
      .from(documents)
      .orderBy(desc(documents.updatedAt));

    return c.json({ documents: allDocuments });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return c.json({ error: "Failed to fetch documents" }, 500);
  }
});

// POST /api/documents
documentsRouter.post("/", zValidator("json", createDocumentSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { title, content } = c.req.valid("json");

  try {
    const result = await db
      .insert(documents)
      .values({
        title,
        content,
      })
      .returning();

    return c.json({ document: result[0] }, 201);
  } catch (error) {
    console.error("Error creating document:", error);
    return c.json({ error: "Failed to create document" }, 500);
  }
});

// GET /api/documents/:id
documentsRouter.get("/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const documentId = parseInt(c.req.param("id"));

  try {
    const documentResult = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (documentResult.length === 0) {
      return c.json({ error: "Document not found" }, 404);
    }

    return c.json({ document: documentResult[0] });
  } catch (error) {
    console.error("Error fetching document:", error);
    return c.json({ error: "Failed to fetch document" }, 500);
  }
});

// PUT /api/documents/:id
documentsRouter.put("/:id", zValidator("json", createDocumentSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const documentId = parseInt(c.req.param("id"));
  const { title, content } = c.req.valid("json");

  try {
    const result = await db
      .update(documents)
      .set({
        title,
        content,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId))
      .returning();

    if (result.length === 0) {
      return c.json({ error: "Document not found" }, 404);
    }

    return c.json({ document: result[0] });
  } catch (error) {
    console.error("Error updating document:", error);
    return c.json({ error: "Failed to update document" }, 500);
  }
});

// DELETE /api/documents/:id
documentsRouter.delete("/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const documentId = parseInt(c.req.param("id"));

  try {
    const documentResult = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (documentResult.length === 0) {
      return c.json({ error: "Document not found" }, 404);
    }

    await db.delete(documents).where(eq(documents.id, documentId));

    return c.json({ message: "Document deleted successfully" });
  } catch (error) {
    console.error("Error deleting document:", error);
    return c.json({ error: "Failed to delete document" }, 500);
  }
});

export { documentsRouter };
