// backend/server.js
require("dotenv").config(); // Garante que as variáveis de ambiente do .env sejam carregadas

const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs"); // Importa bcryptjs para criptografia de senhas
const jwt = require("jsonwebtoken"); // Importa jsonwebtoken para JWTs

const app = express();
const PORT = process.env.PORT || 5000;

// -------------------------------------------------------------------
// 1. Configuração do Prisma Client
// -------------------------------------------------------------------
const prisma = new PrismaClient();

// -------------------------------------------------------------------
// 2. Configuração do Google Gemini AI
// -------------------------------------------------------------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error(
    "Erro: A chave da API Gemini não está configurada. Verifique seu arquivo .env"
  );
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// Usando o modelo gemini-1.5-flash conforme solicitado
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// -------------------------------------------------------------------
// 3. Configuração do JWT
// -------------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error(
    "Erro: A chave JWT_SECRET não está configurada. Verifique seu arquivo .env"
  );
  process.exit(1);
}

// -------------------------------------------------------------------
// 4. Middlewares
// -------------------------------------------------------------------
app.use(cors());
app.use(express.json());

// Middleware para verificar o token JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Formato: Bearer TOKEN

  if (token == null) {
    return res.status(401).json({ error: "Token não fornecido." });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error("Erro na verificação do token:", err);
      return res.status(403).json({ error: "Token inválido ou expirado." });
    }
    req.userId = user.id; // Adiciona o ID do usuário à requisição
    next(); // Continua para a próxima função middleware/rota
  });
}

// -------------------------------------------------------------------
// 5. Rotas da API
// -------------------------------------------------------------------

// Rota de teste simples
app.get("/", (req, res) => {
  res.send("Servidor do Assistente de Estudo Inteligente está rodando!");
});

// Endpoint para gerar flashcards usando a IA (AGORA COM A API REAL)
app.post("/api/generate-flashcards", async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Nenhum texto foi fornecido." });
  }

  // --- CÓDIGO ORIGINAL DA IA (ATIVADO NOVAMENTE) ---
  try {
    const prompt = `Gere uma lista de flashcards (mínimo 3, máximo 7) em formato JSON, com as chaves "pergunta" e "resposta", com base no seguinte texto. Certifique-se de que a saída seja um JSON válido e nada além do JSON.

        Texto: "${text}"

        Exemplo de formato JSON esperado:
        [
          {"pergunta": "Qual é a capital do Brasil?", "resposta": "Brasília"},
          {"pergunta": "Quem descobriu o Brasil?", "resposta": "Pedro Álvares Cabral"}
        ]
        `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let aiResponseContent = response.text();

    console.log("Resposta bruta da IA (Gemini):", aiResponseContent);

    let flashcards;
    try {
      if (aiResponseContent.startsWith("```json")) {
        aiResponseContent = aiResponseContent.substring(7);
      }
      if (aiResponseContent.endsWith("```")) {
        aiResponseContent = aiResponseContent.slice(0, -3);
      }
      const jsonMatch = aiResponseContent.match(/\[.*\]/s);
      if (jsonMatch && jsonMatch[0]) {
        flashcards = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error(
          "Não foi possível extrair um JSON válido da resposta da IA."
        );
      }

      if (
        !Array.isArray(flashcards) ||
        flashcards.some((card) => !card.pergunta || !card.resposta)
      ) {
        throw new Error("Formato de flashcards inválido retornado pela IA.");
      }
    } catch (parseError) {
      console.error("Erro ao parsear JSON do Gemini:", parseError);
      return res.status(500).json({
        error:
          "Erro ao processar a resposta da IA. Tente novamente ou ajuste o texto.",
        details: `A IA não retornou um JSON válido ou no formato esperado. (Detalhes: ${parseError.message})`,
      });
    }

    res.json(flashcards);
  } catch (error) {
    console.error("Erro ao chamar a API do Gemini:", error);
    res
      .status(500)
      .json({
        error:
          "Ocorreu um erro ao gerar os flashcards. Por favor, tente novamente.",
        details: error.message,
      });
  }
});

// NOVO ENDPOINT: Registrar Usuário
app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email e senha são obrigatórios." });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: "Este email já está registrado." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res
      .status(201)
      .json({
        message: "Usuário registrado com sucesso!",
        token,
        userId: user.id,
      });
  } catch (error) {
    console.error("Erro ao registrar usuário:", error);
    res
      .status(500)
      .json({
        error: "Ocorreu um erro ao registrar o usuário.",
        details: error.message,
      });
  }
});

// NOVO ENDPOINT: Login de Usuário
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email e senha são obrigatórios." });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: "Credenciais inválidas." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: "Credenciais inválidas." });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res
      .status(200)
      .json({ message: "Login bem-sucedido!", token, userId: user.id });
  } catch (error) {
    console.error("Erro no login do usuário:", error);
    res
      .status(500)
      .json({
        error: "Ocorreu um erro ao fazer login.",
        details: error.message,
      });
  }
});

// Rotas de Flashcards (PROTEGIDAS POR AUTENTICAÇÃO)
app.post("/api/flashcards", authenticateToken, async (req, res) => {
  const { flashcards } = req.body;
  const userId = req.userId;

  if (!Array.isArray(flashcards) || flashcards.length === 0) {
    return res
      .status(400)
      .json({ error: "Nenhum flashcard válido foi fornecido para salvar." });
  }

  try {
    const dataToSave = flashcards.map((card) => ({
      pergunta: card.pergunta,
      resposta: card.resposta,
      userId: userId,
    }));

    const result = await prisma.flashcard.createMany({
      data: dataToSave,
      skipDuplicates: true,
    });

    res
      .status(201)
      .json({ message: `${result.count} flashcard(s) salvo(s) com sucesso!` });
  } catch (error) {
    console.error("Erro ao salvar flashcards no banco de dados:", error);
    res
      .status(500)
      .json({
        error: "Ocorreu um erro ao salvar os flashcards.",
        details: error.message,
      });
  }
});

app.get("/api/flashcards", authenticateToken, async (req, res) => {
  const userId = req.userId;
  try {
    const flashcards = await prisma.flashcard.findMany({
      where: { userId: userId },
      orderBy: {
        createdAt: "desc",
      },
    });
    res.json(flashcards);
  } catch (error) {
    console.error("Erro ao buscar flashcards do banco de dados:", error);
    res
      .status(500)
      .json({
        error: "Ocorreu um erro ao buscar os flashcards.",
        details: error.message,
      });
  }
});

// Endpoint: Deletar flashcard (PROTEGIDO E ESPECÍFICO DO USUÁRIO)
app.delete("/api/flashcards/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  try {
    const flashcard = await prisma.flashcard.findUnique({
      where: { id: id },
    });

    if (!flashcard) {
      return res.status(404).json({ error: "Flashcard não encontrado." });
    }

    if (flashcard.userId !== userId) {
      return res
        .status(403)
        .json({ error: "Você não tem permissão para deletar este flashcard." });
    }

    await prisma.flashcard.delete({
      where: { id: id },
    });

    res.status(200).json({ message: "Flashcard deletado com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar flashcard:", error);
    res
      .status(500)
      .json({
        error: "Ocorreu um erro ao deletar o flashcard.",
        details: error.message,
      });
  }
});

// -------------------------------------------------------------------
// 6. Inicia o servidor
// -------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});

process.on("beforeExit", async () => {
  await prisma.$disconnect();
});
