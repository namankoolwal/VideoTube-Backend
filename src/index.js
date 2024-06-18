import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config({
  path: "./.env",
});

connectDB()
  .then( ()=>(
    app.listen(process.env.PORT || 8000, () => {
      console.log(`⚙️  Server is running on port ${process.env.PORT || 8000}`);
    }))
  )
  .catch((err) => {
    console.log("Mongodb connection failed ", err);
  });











  
// (async ()=>{
//     try {
//        await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}` )
//        app.on("error", (error) => {
//        console.log("Error: ", error);
//        throw err;
// }),
//     } catch (error) {
//         console.log("Error: ", error)
//         throw error
//     }
// })()
