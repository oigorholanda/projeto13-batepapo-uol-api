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


const schema = Joi.object({
  name: Joi.string().min(3).required(),

}) 

app.get("/participants", async (req, res) => {
  const users = await db.collection("participants").find().toArray();
  res.send(users);
});


app.post("/participants", async (req, res) => {
  const name = req.body;
  const validate = schema.validate(name)
  
  if (validate.error) return res.status(422).send(validate.error.message);

  try {
    const busyUsername = await db.collection("participants").findOne({ name:name.name });

    if (busyUsername) return res.status(409).send("Nome de usuário já cadastrado");

    await db.collection("participants").insertOne({ 
        name: name.name,
        lastStatus: Date.now()
     });
    await db.collection("messages").insertOne({
      from: name.name, 
      to: 'Todos', 
      text: 'entra na sala...', 
      type: 'status', 
      time: dayjs().format("HH:mm:ss")
     })
    return res.status(201).send("Usuário Cadastrado");

  } catch (error) {
    console.log("Erro ao inserir o usuário", error);
  }
});

app.delete("/participants/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await db.collection("participants").deleteOne({ _id: ObjectId(id) });

    res.status(202).send("OK");
  } catch (error) {
    console.log("Erro ao deletar o post", error);
  }
});

app.get("/messages", async (req, res) => {
  const messages = await db.collection("messages").find().toArray();
  res.send(messages);
});

const PORT = process.env.PORT;

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
