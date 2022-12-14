const express = require('express')
const url = require("url")
const fs = require('fs/promises')
const { type } = require('os')
const { stringify } = require('querystring')

const transactionPath = "./data/transactions.json"
const transactionArr = require("../data/transactions")

const balanceFilePath = "./data/balance.json"
const balance = require("../data/balance.json")

const { transcode } = require('buffer')
const { json } = require('body-parser')

const router = express.Router()

const FindTransactionbyDate = (transactionArr, target) => {
    if(transactionArr&&target){
        let NumofTransaction = transactionArr.length
        for(let i = 0; i < NumofTransaction; i++){
            if(transactionArr[i]["transaction-date"] === target["transaction-date"]){
                return i
            }
        }
        return -1
    }   
    else
        return -1
}

const FindTransactionbyID = (transactionArr, target, dateIndex) => {
    if(transactionArr&&target){
        const transactionGroup = transactionArr[dateIndex].data
        let NumofTransaction = transactionGroup.length

        for(let i=0; i<NumofTransaction; i++){
            if(transactionGroup[i]["transactionID"] === target["transactionID"]){
                return i
            }
        }

        return -1
    }
    else{
        return -1
    }
}

const CreateNewTransactionID = (index,transaction) => {
    if(transaction){
        const date = transaction['transaction-date']
        let key = 0
        if(index >= 0){
            const lastTransactionID = transactionArr[index].data[0]["transactionID"]
            const splitterIndex = lastTransactionID.indexOf("_")
            const id = lastTransactionID.substring(splitterIndex+1);
            key = Number(id) + 1
        }
        transaction.data[0]['transactionID'] = `${date}_${key}`
    }
}

const AddTransaction = (index, data) => {
    if(transactionArr&&data){
        if(index >=0){
            const transaction = data.data[0]
            transactionArr[index].data.unshift(transaction)
        }
        else{
            transactionArr.unshift(data)
        }
    }
}

const RemoveTransaction = (groupIndex, transactionIndex)=>{
    if(transactionIndex>=0){
        transactionArr[groupIndex].data.splice(transactionIndex,1)
        const numOfRemainTransactions = transactionArr[groupIndex].data.length
        if(numOfRemainTransactions <=0){
            transactionArr.splice(groupIndex,1)
        }
    }
}

const UpdateTransactionDetails = (dateIndex, transactionIndex, changes) => {
    const transaction = transactionArr[dateIndex].data[transactionIndex]

    for(let key in changes){
        if(key != "transaction-date"){
            transaction[key] = changes[key]
        }
    }
    

    return transaction
}

const WriteToTransactionFile = ()=>{
    return fs.writeFile(transactionPath,JSON.stringify(transactionArr))
}

const GetCurrentBalance = async () =>{
    try {
        const totalBalance = await fs.readFile(balanceFilePath, {
          encoding: "utf8",
        });
        console.log(totalBalance)
        return JSON.parse(totalBalance)
      } catch (err) {
        console.log("=====Error occured during getting current balance======")
        console.log(err)
        return err
      }
}


router.route("/")
.get(async (req,res) => {
    try{
        const transactions = await fs.readFile(transactionPath, {encoding: "utf8"});

        res.status(200).send(transactions)
    }
    catch(err){
        res.status(404).send(err)
    }
})
.post(async (req,res)=>{
    if(Object.keys(req.body).length>=2){
        try{
            console.log("====Start a new transaction created request====")
            const data = req.body
            const index =  FindTransactionbyDate(transactionArr, data)
            CreateNewTransactionID(index, data)
            AddTransaction(index, data)
            console.log("====Start writing new transactions to the file====")
            const writeFile = await WriteToTransactionFile()
            if(writeFile){
                throw writeFile
            }
            else{
                res.status(200).json(data)
            }
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

router.route("/:transactionID")
.post(async (req,res)=>{
    const transactionID = req.params["transactionID"]
    if(Object.keys(req.body).length>0 && transactionID){
        console.log("====Start a new transaction updated request====")
        const changes = req.body
        const target = {"transactionID": transactionID}
        try{
            const splitterIndex = transactionID.indexOf("_")
            const originalDate = transactionID.substring(0,splitterIndex)
            target["transaction-date"] = originalDate
            console.log("====Locating transaction...====")
            let dateIndex = FindTransactionbyDate(transactionArr, target)
            if(dateIndex >=0){
                let transactionIndex = FindTransactionbyID(transactionArr,target,dateIndex)
                console.log("====Found transactions====")
                try{
                    if(transactionIndex >= 0){
                    const originalTransaction = transactionArr[dateIndex].data[transactionIndex]
                    const originalAmount = originalTransaction["transaction-amount"]

                    console.log("====Start update transaction changes====")
                    const updatedTransaction = UpdateTransactionDetails(dateIndex, transactionIndex, changes)
                    
                        // Update the total balance if transaction amount is updated
                        if(changes["transaction-amount"]){
                            console.log("====Start update transaction AMOUNT====")
                            const newAmount = changes["transaction-amount"]
                            const originalBalance = balance["total-balance"]
                            const newBalance = originalBalance + originalAmount - newAmount
                            balance["total-balance"] = newBalance
                            console.log("====Complete update transaction AMOUNT====")
                        }

                        //Update new position in transaction array if transaction date has change
                        if(changes["transaction-date"]){
                            console.log("====Start update transaction DATE====")
                            const shadowCopy = {...updatedTransaction}
                            const newTransaction = {
                                "data": [shadowCopy],
                                "transaction-date": changes["transaction-date"]
                            }

                            const newPosition = FindTransactionbyDate(transactionArr, newTransaction)
                            CreateNewTransactionID(newPosition,newTransaction)
                            AddTransaction(newPosition,newTransaction)

                            // Remove the original transaction
                            dateIndex = FindTransactionbyDate(transactionArr, target)
                            console.log(dateIndex)

                            transactionIndex = FindTransactionbyID(transactionArr,target, dateIndex)
                            console.log(transactionIndex)
                            RemoveTransaction(dateIndex, transactionIndex)
                            console.log("====Complete update transaction DATE====")

                        }
                    }
                    else
                        throw err

                    
                }
                catch(err){
                    console.log(err)
                    if(transactionIndex < 0){
                        return res.status(404).send("Could not locate transaction by transactionID")

                    }
                    else{
                        return res.status(503).send("Internal Sever Error!")

                    }
                }
                finally{
                    // Write transactions to file
                    console.log("====Start writing update to the files====")
                    const writeFile = await WriteToTransactionFile()
                    if(writeFile){
                        console.log(writeFile)
                        throw writeFile
                    }
                    else{
                        target["changes"] = changes
                        if(changes["transaction-amount"]){
                            console.log("====Start writing NEW BALANCE to files====")
                            //Write updated balance to file
                            await fs.writeFile(balanceFilePath, JSON.stringify(balance)).then(()=>{
                                console.log("====Complete the update request====")
                                return res.status(200).send(target)
                            }).catch(err=>{throw err})

                        }
                        else{
                            console.log("====Complete the update request====")
                            return res.status(200).send(target)
                        }
                    }
                    
                }

    
            }
            else{
                res.status(404).send("Could not locate transaction by date")
            }

            

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
.delete(async (req,res)=>{
    console.log("=====Start Delete Request=======")
    const transactionID = req.params["transactionID"]
    const splitterIndex = transactionID.indexOf("_")
    const transactionDate = transactionID.substring(0,splitterIndex)
    const searchTarget = {
        "transaction-date": transactionDate,
        "transactionID": transactionID
    }
    console.log("=====Finding transaction...=======")
    const dateIndex = FindTransactionbyDate(transactionArr, searchTarget)
    if(dateIndex>=0){
        console.log("=====Found transaction DATE...=======")
        const transactionIndex = FindTransactionbyID(transactionArr,searchTarget,dateIndex)
        if(transactionIndex >= 0){
            console.log("=====Found transaction INDEX...=======")
            try{
                
                const deletedTransaction = transactionArr[dateIndex].data[transactionIndex]
                console.log(`Delete target:`)
                console.log(deletedTransaction)
                console.log("=====Get current balance...=======")
                const balance = await GetCurrentBalance()
                console.log(`Current balance: ${balance["total-balance"]}`)
                console.log("=====Update new balance...=======")
                const transactionAmount = deletedTransaction["transaction-amount"]
                console.log(`Balance after update: ${balance["total-balance"]} + ${transactionAmount}`)
                balance["total-balance"] += transactionAmount
                console.log(`Updated balance: ${balance["total-balance"]}`)

                console.log("=====Remove the original transaction...=======")
                RemoveTransaction(dateIndex,transactionIndex)

                console.log("=====Re-write transaction to files...=======")
                 // Write transactions to file
                const writeFile = await WriteToTransactionFile(searchTarget)
                if(writeFile){
                    throw writeFile
                }
                else{
                    console.log("=====Re-write new balance to files...=======")
                    await fs.writeFile(balanceFilePath, JSON.stringify(balance)).then(()=>{
                        console.log("=====Complete delete request...=======")
                        res.status(200).json(searchTarget)
                    }).catch(err=>{throw err})
                }
            }
            catch(err){
                console.log(err)
                res.status(503).send("Error while deleting transaction")
            }
        }
        else{
            res.status(404).send("Could not find transactionID")
        }
    }
    else{
        res.status(404).send("Could not find transaction date")
    }
    
})

module.exports = router