
// WAY ONE USING TRY CATCH BLOCK
// const asyncHandler = (fn) => async(req, res, next) =>{
//     try {
//         await fn(req, res, next)
//     } catch (error) {
//         res.status(error.code || 500).json({
//             success: false,
//             message: error.message || "Internal Server Error"
//         })
//     }
// }


// WAY TWO USING PROMISE
const asyncHandler =(requestHandler)=>{
   return (req, res, next)=>{
        Promise.resolve(requestHandler(req,res,next)).catch((error)=> next(error))
    }
}


export default asyncHandler