import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import mongoose from 'mongoose'
import crypto from 'crypto'
import bcrypt from 'bcrypt-nodejs'

import data from './data.json'
import dotenv from 'dotenv'
import cloudinary from 'cloudinary'
import cloudinaryStorage from 'multer-storage-cloudinary'
import multer from 'multer'


dotenv.config()

cloudinary.config({
  cloud_name: "dc2tplzzd",
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

const storage = cloudinaryStorage({
  cloudinary,
  folder: "plants",
  allowedFormats: ["jpg", "png"],
  transformation: [{width: 500, height: 500, crop: "limit"}]
})

const parser = multer({ storage })

const mongoUrl = process.env.MONGO_URL || "mongodb://locahost/webshop-plants"
mongoose.connect(mongoUrl, { useNewParser: true, useUnifiedTopology: true })
mongoose.Promise = Promise

const User = mongoose.model("User", {
  name: {
    type: String,
    unique: true
  },
  email: {
    type: String, 
    unique: true
  },
  accessToken: {
    type: String, 
    default: () => crypto.randomBytes(128).toString("hex")
  }
})

const Product = mongoose.model("Product", {
  id: Number,
  img: String, 
  title: String,
  altName: String,
  description: String,
  difficulty: String,
  exposure: String,
  watering: String,
  price: Number,
  isFeatured: Boolean
})

const seedDataBase = async () => {
  await Product.deleteMany()
  data.forEach((product) => new Product(product).save())
}
seedDataBase()

const port = process.env.PORT || 8080
const app = express()

// middlewares to enable cors and json body parsing
app.use(cors())
app.use(bodyParser.json())

const authenticateUser = async (req, res, next) => {
  try {
    const user = await User.findOne({ accessToken: req.header("Authorization") })
    console.log(req.header("Authorization"))

    if (user) {
      req.user = user
      next()
    } else {
      res.status(401).json({loggedOut: true, message: "Please try logging in again"})
    }
  } catch (err) {
    res
      .status(403)
      .json({ message: "access token is missing or wrong", errors: err.errors })
  }
}

// defining the routes here
app.get('/', (req, res) => {
  res.send('Welcome to the webshop')
})

// login
app.get("/login", (req, res) => {
  res.send("hello login :)")
})

// get the users
app.get("/users", async (req, res) => {
  const users = await User.find()
  res.json(users)
})

app.post("users", async (req, res) => {
  try {
    const { name, email, password } = req.body
    const user = new User({ name, email, password: bcrypt.hashSync(password) })
    user.save()
    res.status(201).json({ id: user._id, name: user.name, accessToken: user.accessToken })
  } catch (err) {
    res.status(400).json({ message: "Could not save user 1", errors: err.errors })
  }
})

//user by id
app.get("/users/:id", authenticateUser)
app.get("/users/:id", (req, res) => {
  try {
    res.status(201).json(req.user)
  } catch (err) {
    res.status(400).json({message: "could not save user 2", errors: err.errors})
  }
})

// Login
app.post("/sessions", async (req, res) => {
  const user = await User.findOne({ name: req.body.name })
  
  if (user && bcrypt.compareSync(req.body.password, user.password)) {
    res.json({ userId: user._id, name: user.name, accessToken: user.accessToken })
  } else {
    res.json({ notFound: true })
  }
})

// secrets
app.get("secrets", authenticateUser)
app.get("/secrets", (req, res) => {
  res.json({ secret: "this is a secret message" })
})

// all products
app.get("/products", async (req, res) => {
  const products = await Product.find(req.query)

  if (data.length === 0) {
    res.status(404).send("Not found, try again!")
  } else {
    res.json(products)
  }
})

// cloudinary images
app.post("/products", parser.single("image"), async (req, res) => {
  req.send("Amazing! Uploaded!")
})

// find by id
app.get("/products/:id", (req, res) => {
  Product.findOne({ id: req.params.id }).then(product => {
    if (product) {
      res.json(product)
    } else {
      res.status(404).json({ error: "Product not found, try again!" })
    }
  })
})

// find by price
app.get("/products/price/:price", (req, res) => {
  Product.find({ price: req.params.price }).then(product => {
    if (product) {
      res.json(product)
    } else {
      res.status(404).json({error: "Product not found :("})
    }
  })
})

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
