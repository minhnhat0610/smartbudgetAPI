const express = require("express")
const cors = require("cors")
const bodyParser = require("body-parser")

const balanceRouter = require("./routes/balance")
const transactionRouter = require("./routes/transactions")

const app = express()

app.use(cors())

app.use(express.json())
app.use(express.urlencoded({extended: false}))
app.use("/api/balance",balanceRouter)
app.use("/api/transactions", transactionRouter)

app.listen(5000, ()=>{
    console.log("Server is started on 5000")
})