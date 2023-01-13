import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { MongoClient, ObjectId } from "mongodb"


const app = express()
app.use(cors())
app.use(express.json())
dotenv.config()

const mongoClient = new MongoClient(process.env.DATABASE_URL)
let db;


    mongoClient.connect().then( () => {
        db = mongoClient.db()
        console.log("Conectado ao banco de dados");
    }) .catch ( (error) => {
        console.log(error);
        console.log("Algo na conexão com o banco deu errado");
    })
    
    

app.get("/usuarios", async (req, res) => {
    const users = await db.collection("users").find().toArray()
    res.send(users)
})

app.post("/usuarios", async (req, res) => {
    await db.collection("users").insertOne({
		email: "joao@email.com",
		password: "minha_super_senha"
	})
    res.status(201).send("Usuário Cadastrado")
})

app.delete("/usuarios/:id", async (req, res) => {
    const { id } = req.params
   
    try {
       await db.collection("users").deleteOne( {_id: ObjectId(id)})

        res.status(202).send("OK")

    } catch (error) {
        console.log("Erro ao deletar o post", error); 
    }
    

})



const PORT = process.env.PORT

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))