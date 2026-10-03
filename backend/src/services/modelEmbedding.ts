import { GoogleGenerativeAI } from "@google/generative-ai";
import envVariable from "../utils/ENV.js";

const genAI = new GoogleGenerativeAI(envVariable.GEMINI_EMBEDDING_KEY);
const model = genAI.getGenerativeModel(
  { model: "gemini-embedding-001" },
  { apiVersion: "v1" }
);

async function generateEmbedding(text:string) {
  const result = await model.embedContent(text);
  return result.embedding.values;
}
