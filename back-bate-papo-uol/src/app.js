import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import Joi from "joi";
import dayjs from "dayjs";

const app = express();
app.use(cors());
app.use(express.json());
dotenv.config();

const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

mongoClient
  .connect()
  .then(() => {
    db = mongoClient.db();
    console.log("Conectado ao banco de dados");
  })
  .catch((error) => {
    console.log("Algo na conexão com o banco deu errado", error);
  });



app.get("/participants", async (req, res) => {
  const users = await db.collection("participants").find().toArray();
  res.send(users);
});


app.post("/participants", async (req, res) => {
  const name = req.body;
  const schema = Joi.object({ name: Joi.string().min(3).required() });
  const validate = schema.validate(name);

  if (validate.error) return res.status(422).send(validate.error.message);

  try {
    const busyUsername = await db.collection("participants").findOne({ name: name.name })

    if (busyUsername)
      return res.status(409).send("Nome de usuário já cadastrado");

    await db.collection("participants").insertOne({
      name: name.name,
      lastStatus: Date.now(),
    });

    await db.collection("messages").insertOne({
      from: name.name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });

    res.status(201).send("Usuário Cadastrado");
  } catch (error) {
    console.log(error);
    return res.status(500).send("Erro ao inserir o usuário");
  }
});

// ALterar para deletar mensagens depois
app.delete("/messages/:id", async (req, res) => {
  const { id } = req.params;
  const name = req.headers.user;

  try {
    const delMsg = await db.collection("messages").findOne({ _id: ObjectId(id) });

    if (!delMsg) return res.status(404).send("Não exite mensagem com esse ID");

    if (delMsg.from !== name) return res.status(401).send("Mensagem não é do usuário");

    await db.collection("messages").deleteOne({ _id: ObjectId(id) });

    res.status(202).send("Apagada");
  } catch (error) {
    console.log("Erro ao deletar a mensagem", error);
  }
});

app.get("/messages", async (req, res) => {
  const limit = req.query.limit;
  const name = req.headers.user;

  if ((limit && isNaN(limit)) || limit <= 0) return res.sendStatus(422);

  try {
    const limitedMessages = await db
      .collection("messages")
      .find({
        $or: [
          { from: name },
          { type: "message" },
          { type: "status" },
          { type: "private_message", to: name },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .toArray();

    res.send(limitedMessages);
  } catch (error) {
    console.log(error);
    return res.status(500).send("Erro ao requisitar a mensagem");
  }
});

app.post("/messages", async (req, res) => {
  const name = req.headers.user;
  const { to, text, type } = req.body;
  const schema = Joi.object({
    to: Joi.string().required(),
    text: Joi.string().required(),
    type: Joi.any().valid("message", "private_message").required(),
  });
  const validation = schema.validate(req.body, { abortEarly: false });

  if (validation.error) return res.status(422).send(validation.error.message);

  try {
    const logedUser = await db.collection("participants").findOne({ name });

    if (!logedUser) return res.status(422).send("Usuário não logado");

    await db.collection("messages").insertOne({
      from: name,
      to,
      text,
      type,
      time: dayjs().format("HH:mm:ss"),
    });

    res.status(201).send("Mensagem postada");
  } catch (error) {
    console.log(error);
    return res.status(500).send("Erro ao postar a mensagem");
  }
});

app.post("/status", async (req, res) => {
  const name = req.headers.user;

  try {
    const activeUser = await db.collection("participants").updateOne({ name }, { $set: { lastStatus: Date.now() } });

    if (activeUser.modifiedCount === 0) return res.status(404).send("Usuário não logado");

    res.sendStatus(200);
  } catch (error) {
    console.log(error);
    return res.status(500).send("Erro ao localizar o participante");
  }
});

setInterval(async () => {
  const compareDate = Date.now() - 10000;

  try {
    const inactivity = await db
      .collection("participants")
      .find({ lastStatus: { $lte: compareDate } })
      .toArray();

    if (inactivity.length > 0) {
      const inactivityMessages = inactivity.map((user) => {
        return {
          from: user.name,
          to: "Todos",
          text: "sai da sala...",
          type: "status",
          time: dayjs().format("HH:mm:ss"),
        };
      });

      await db.collection("messages").insertMany(inactivityMessages);
      await db.collection("participants").deleteMany({ lastStatus: { $lte: compareDate } });
    }
  } catch (error) {
    return console.log(error.message);
  }
}, 15000);

const PORT = 5000;

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
