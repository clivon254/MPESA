

import express from "express"
import cors from "cors"
import "dotenv/config"
import axios from "axios"
import mongoose from "mongoose"
import Payment from "./model/paymentModel.js"

const app = express()

const PORT = 2000

app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(cors())



// DB CONNECTION
mongoose.connect(process.env.MONGO_URL)
.then(() => {
    console.log("DB Connected")
})
.catch((err) => {
    console.log(err)
})



app.get('/',(req,res) => {

    res.send("Hello mpesa")
    
})

// generateToken
const generateToken = async (req,res,next) => {

    const secrete = process.env.CONSUMER_SECRETE

    const consumer = process.env.CONSUMER_KEY

    const auth = new Buffer.from(`${consumer}:${secrete}`).toString("base64")

    await axios.get(
        "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",{
        headers:{
            authorization : `Basic ${auth}`
        }
    })
    .then((response) => {

        req.token = response.data.access_token

        next()
    })
    .catch((err) => {

        console.log(err)

    })
}


// stk push
app.post("/stk", generateToken ,async (req,res) => {

    const token = req.token;

    const phone = req.body.phone.substring(1) ;

    const amount = req.body.amount ;

    const date = new Date();

   const timestamp = 
      date.getFullYear() + 
      ("0" + (date.getMonth() + 1)).slice(-2) +
      ("0" + date.getDate()).slice(-2) +
      ("0" + date.getHours()).slice(-2) +
      ("0" + date.getMinutes()).slice(-2) +
      ("0" + date.getSeconds()).slice(-2) 

    const shortcode = process.env.PAYBILL 

    const passkey = process.env.PASS_KEY ;

    const password = new Buffer.from(shortcode + passkey + timestamp).toString("base64")

    await axios.post(
        "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
        {    
            "BusinessShortCode": shortcode,    
            "Password": password,    
            "Timestamp":timestamp,    
            "TransactionType": "CustomerPayBillOnline",//"customerBuyGoodsOnline"    
            "Amount": amount,    
            "PartyA":`254${phone}`,    
            "PartyB":shortcode,    
            "PhoneNumber":`254${phone}`,    
            "CallBackURL": "https://0c12-41-209-60-94.ngrok-free.app/callback",    
            "AccountReference":`CLIVON OSIRE COMPANY`,    
            "TransactionDesc":"Test"
        },
        {
            headers:{
                Authorization:`Bearer ${token}`
            }
        }
    )
    .then((response) => {

        res.status(200).json(response.data)

    })
    .catch((err) => {

        console.log(err.message)

        res.status(400).json(err.message)

    })

})


// callback
app.post('/callback', async (req,res) => {

    const callbackData = req.body ;


    if(!callbackData.Body.callbackMetadata)
    {
        console.log(callbackData.Body)

        res.json("ok")
    }


    const phone =  callbackData.Body.stkCallback.callbackMetadata.Item[4].Value

    const amount = callbackData.Body.stkCallback.callbackMetadata.Item[0].Value

    const trnx_id = callbackData.Body.stkCallback.callbackMetadata.Item[1].Value

    console.log({phone, amount, trnx_id})

    const payment = new Payment()

    payment.number = phone ;

    payment.amount = amount ;

    payment.trnx_id = trnx_id ;

    await Payment.save()
            .then((response) => {
                console.log({message:"saved successfully",response})
            })
            .catch((err) => {
                console.log(err.message)
            })

})



// LISTENING 
app.listen(PORT, () => {

    console.log(`Server running on port ${PORT}`)

})



