//Paquetes requeridos
const express = require("express");
const ejs = require("ejs");
const app = express();
const bodyParser = require("body-parser");
const multer = require("multer");
const fs = require("fs");
const pdf = require("pdf-parse");
//Paquetes de Lanchain
const { OpenAI } = require("langchain/llms/openai");
const { RetrievalQAChain } = require("langchain/chains");
const { HNSWLib } = require("langchain/vectorstores/hnswlib");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
//Archivos
/*const upload = multer({
    dest: 'uploads'
});*/
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads"); // Ruta donde se guardarán los archivos subidos
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname); // Usa el nombre original del archivo
  },
});
const upload = multer({ storage });
//Declaraciones necesarias
require("dotenv").config();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
const PORT = process.env.PORT || 3000;
//Variables globales
let respondModel = "";
let consultPrev = "";
let chain = "";
let pdfTitle = "";
//Certificado deshabilitado
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
//--------------------------------Servidor------------------------------------------
app
  .route("/")
  .get((req, res) => {
    res.render("upload");
  })
  .post((req, res) => {
    res.render("upload");
  });
//Attach file
app.post("/load", upload.single("loadFile"), async (req, res) => {
  //Variables locales
  let pdfPath = req.file.path;
  pdfTitle = req.file.originalname;
  let contentPdf = "";
  let vectorStore = "";
  //Lectura del PDF
  const databuffer = fs.readFileSync(pdfPath);
  await pdf(databuffer).then(function (data) {
    contentPdf = data.text;
    //res.send(contentPdf);
  });
  //Modelo al cual se hace la pregunta del usuario
  const model = new OpenAI({
    openAIApiKey: process.env.OPEN_AI_KEY,
  });
  //Configuración del metodo para dividir textos
  const textSplitter = new RecursiveCharacterTextSplitter({
    separator: "\n",
    chunkSize: 1000,
    chunkOverlap: 200,
    lengthFunction: (contentPdf) => contentPdf.length,
  });
  //División del texto del PDF en pedazos
  const chunks = await textSplitter.splitText(contentPdf);
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPEN_AI_KEY,
  });
  //Creación de la tienda de vectores o index
  vectorStore = await HNSWLib.fromTexts(chunks, [], embeddings);
  //Inicializa un retriever alrededor de la tienda de vectores
  const vectorStoreRetriever = await vectorStore.asRetriever();
  //Creación del chain que usa el modelo LLM y el retriver de la tienda de vectores
  chain = RetrievalQAChain.fromLLM(model, vectorStoreRetriever);
  /*Busqueda en la base de conocimiento de la pregunta del usuario
    const docs = await vectorStore.similaritySearch(req.body.questionModel);*/
  res.render("home", {
    pdfTitle: pdfTitle,
    respondModel: respondModel,
    consultPrev: consultPrev,
  });
});
//GPT request
app.post("/gpt", async (req, res) => {
  //Llama la cadena dando en el prompt el contexto y la pregunta
  const response = await chain.call({
    query: req.body.questionModel,
  });
  res.render("home", {
    pdfTitle: pdfTitle,
    respondModel: response.text,
    consultPrev: req.body.questionModel,
  });
});
//Test
/*app.post("/test", upload.single("loadFile"), async (req, res) => {
    //Variables locales
    let contentPdf = "";
    let pdfTitle = req.file.originalname;
    let pdfPath = req.file.path;
    //Lectura del PDF
    const databuffer = fs.readFileSync(pdfPath);
    await pdf(databuffer).then(function (data) {
        contentPdf = data.text;
        //res.send(contentPdf);
    });
    res.render("home", {
        pdfTitle: pdfTitle,
        respondModel: respondModel,
        consultPrev: consultPrev
    });
});*/
app.listen(PORT, function () {
  console.log("Servidor corriendo en el puerto 3000");
});
