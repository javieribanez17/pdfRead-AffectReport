//Paquetes requeridos
const express = require("express");
const ejs = require("ejs");
const app = express();
const bodyParser = require("body-parser");
const multer = require("multer");
const fs = require("fs");
const pdf = require("pdf-parse");
//Paquetes de Lanchain para leer pdf
const { OpenAI } = require("langchain/llms/openai");
const { RetrievalQAChain } = require("langchain/chains");
const { HNSWLib } = require("langchain/vectorstores/hnswlib");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
//Paquetes de LangChain adicionales para extraer datos de Affect Report
const { PromptTemplate } = require("langchain/prompts");
const { LLMChain } = require("langchain/chains");
const { StructuredOutputParser } = require("langchain/output_parsers");
const { z } = require("zod");
//Declaraciones necesarias
require("dotenv").config();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
const PORT = process.env.PORT || 3000;
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
//Variables globales
let respondModel = "";
let respondModelA = [];
let consultPrev = "";
let pdfTitle = "";
let qModel = "";
let jsonArray = [];
//Extraccion de datos AR
const parser = StructuredOutputParser.fromZodSchema(
  z.object({
    paciente: z.object({
      triage: z
        .string()
        .describe(
          "Si el paciente esta en peligro de muerte:{Critico}\nSi requiere hospitalización:{Urgente}\nSi no es ni Critico ni urgente:{General}"
        ),
      nombre: z.string().describe("Nombre del paciente"),
      genero: z.string().describe("¿El paciente es hombre o mujer?"),
      edad: z.string().describe("Edad del paciente al presentar la queja"),
      nacimiento: z.string().describe("Fecha de nacimiento"),
      altura: z.string().describe("Estatura"),
      peso: z.string().describe("Peso"),
    }),
    descripcion: z.object({
      indicacion: z.string().describe("Indicación médica del paciente"),
      medicacion: z
        .array(z.string())
        .describe("Medicación previa del paciente"),
      id: z.string().describe("¿Cuál es el Patient ID?"),
      medicamentos: z
        .array(z.string())
        .describe("Medicamentos consumidos por el paciente"),
      via: z.string().describe("Vía de administración del medicamento"),
      dosis: z.string().describe("Dosis del medicamento consumida"),
      sintomas: z.array(z.string()).describe("Sintomas del paciente"),
    }),
    producto: z.object({
      nombre: z.string().describe("Nombre del producto sospechoso"),
      lugar: z.string().describe("Dónde fue comprado el prodcuto"),
    }),
    informante: z.object({
      tipo: z
        .string()
        .describe("Relación de quien hace el reporte con el paciente"),
      nombre: z.string().describe("Nombre del informante"),
      pais: z.string().describe("País desde donde reporta"),
    }),
    fechas: z.object({
      notificacion: z.string().describe("¿Cuando realizó el primer reporte?"),
      actual: z.string().describe("Fecha del reporte actual"),
      uso: z
        .string()
        .describe("¿Cuando empezó el paciente a consumir el medicamento?"),
    }),
  })
);
const formatInstructions = parser.getFormatInstructions();
const prompt = new PromptTemplate({
  template:
    "Extrae y clasifica la siguiente información:\n{format_instructions}\nA partir del texto:\n{text}\nSi no encuentras algunos datos dentro del texto deja su valor vacío excepto en 'triage'",
  inputVariables: ["text"],
  partialVariables: { format_instructions: formatInstructions },
});
const model = new OpenAI({
  modelName: "gpt-3.5-turbo",
  openAIApiKey: process.env.OPEN_AI_KEY,
  temperature: 0,
});
const chain = new LLMChain({
  llm: model,
  prompt: prompt,
});
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
  const reports = contentPdf.split(/\n\s*\n/);

  for (const report of reports) {
    if (report != "") {
      try {
        qModel = await prompt.format({
          text: report,
        });
        respondModel = await chain.call({ text: qModel });
        console.log("llegue acá");
        jsonOutputM = await JSON.parse(respondModel.text);
        respondModelA.push(jsonOutputM);
      } catch (err) {
        console.log(
          "Hubo un error al comunicarse con el modelo de OpenAI: " + err
        );
      }
    }
  }

  res.render("home", {
    pdfTitle: pdfTitle,
    paciente: respondModelA,
    consultPrev: consultPrev,
  });
});
//GPT request
app.post("/gpt", async (req, res) => {
  const response = await chain.call({
    query: req.body.questionModel,
  });
  res.render("home", {
    pdfTitle: pdfTitle,
    paciente: respondModelA,
    consultPrev: req.body.questionModel,
  });
});

app.listen(PORT, function () {
  console.log("Servidor corriendo en el puerto 3000");
});
