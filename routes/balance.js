const { json } = require('body-parser')
const express = require('express')
const fs = require('fs/promises')

const router = express.Router()
const balanceFilePath = "./data/balance.json"
router.route("/")
.get(async (req, res) => {
  try {
    const totalBalance = await fs.readFile(balanceFilePath, {
      encoding: "utf8",
    });

    res.status(200).json(JSON.parse(totalBalance));
  } catch (err) {
    res.status(404).send(err);
  }
})
.post(async (req,res) => {
    if(Object.keys(req.body).length>0){
        try{
            const data = JSON.stringify(req.body)
            await fs.writeFile(balanceFilePath,data).then(()=>{
                res.status(200).json(req.body)
            }).then(err => {
                console.log(err)
                throw err
            })
        }
        catch(err){
            console.log(err)
            res.status(503).send(err)
        }
    
    }
    else{
        res.status(404).send("No data sent to server")
    }
})

module.exports = router