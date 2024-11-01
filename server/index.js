

import express from "express"
import cors from "cors"
import "dotenv/config"
import axios from "axios"
import mongoose from "mongoose"
import Payment from "./model/paymentModel.js"
import ngrok from "ngrok"


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
        "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
        {
        headers:{
            authorization : `Basic ${auth}`
        }
    })
    .then((response) => {

        req.token = response.data.access_token

        next()
    })
    .catch((err) => {

        console.log(err.messgae)

        console.log("yap that's me")

    })
}


// testing access_token
app.get('/access_token', generateToken ,(req,res) => {

    res.status(200).json({
        success:true,
        message:'Token generated successfully',
        token:req.token
    })

})


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
            "TransactionType":"CustomerPayBillOnline",//"customerBuyGoodsOnline"    
            "Amount": amount,    
            "PartyA":`254${phone}`,    
            "PartyB":shortcode,    
            "PhoneNumber":`254${phone}`,    
            "CallBackURL":"https://mpesa-3h54.onrender.com/callback",
            "AccountReference":`CLIVON OSIRE COMPANY`,    
            "TransactionDesc":"Test"
        },
        {
            headers:{
                "Authorization":`Bearer ${token}`,
                "Content-Type":"application/json"
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

    console.log("Full Callback Data",JSON.stringify(req.body, null,2))

    console.log("finally bro you made it")

    // check if body exists
    if(!req.body.Body)
    {
        throw new Error("Callback body structure is invalid.'Body' feild is invalid")
    }

    const {
        MerchantRequestID,
        CheckoutRequestID,
        ResultCode,
        ResultDesc,
        CallbackMetadata
    } = req.body.Body.stkCallback


    const metaItems = Object.values(await CallbackMetadata.Item)

    const amount = metaItems.find(item => item.Name === 'PhoneNumber')?.Value.toString()

    const phone = metaItems.find(item => item.Name === 'Amount')?.Value.toString()

    const trnx_id = metaItems.find(item => item.Name === 'MpesaReceiptNumber')?.Value.toString()
     

    const payment = new Payment({
        phone,
        amount,
        trnx_id
    })

    res.status(200).json({success:true , payment})

})


// cornfirmPayment
app.post('/confirmPayment/:CheckoutRequestID',generateToken, async (req,res) => {

    try
    {
        const token = req.token

        const auth = "Bearer" + token

        const date = new Date();

        const url = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest"

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
        

        const requestBody = {
            "BusinessShortCode":shortcode,
            Password:password,
            Timestamp:timestamp,
            CheckoutRequestID:req.params.CheckoutRequestID
        }

        const response = await axios.post(
            url,
            requestBody,
            {
                headers:{
                    "Authorization":auth,
                    
                }
            }
        )

        res.status(200).json(response.data)

    }
    catch(error)
    {
        console.log("Error wwhile trying to create stk")

        res.status(503).send({
            message:"Something went wrong",
            error:error.message || error
        })
    }

})


// payments
app.get('/getPayments',async (req,res) => {

  try
  {
    const payMents = await Payment.find({})

    res.status(200).json({success:true ,payMents})

  }
  catch(error)
  {
    console.log(error.messege)
  }

})




// LISTENING 
app.listen(PORT, () => {

    console.log(`Server running on port ${PORT}`)

})



