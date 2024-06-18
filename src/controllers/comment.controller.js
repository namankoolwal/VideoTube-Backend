import mongoose , {isValidObjectId} from "mongoose"
import {Comment} from "../models/comment.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import asyncHandler from "../utils/asyncHandler.js"
import { User } from "../models/user.model.js"
import { Video } from "../models/video.model.js"


const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    // get videoId from params and validate object id
    const {videoId} = req.params
    if(!isValidObjectId(videoId)){
        throw new ApiError(400 , "Invalid video id")
        }
    
    // get page and limit from query params 
    const {page = 1, limit = 10} = req.params
    
    const video = await Video.findById(videoId)
    if(!video){
        throw new ApiError(404 , "Video not found")
    }

    // find all comments for the video and populate owner field with username and avatar
    const commentAggrigate = Comment.aggregate([
        {
          $match: {
           video: new mongoose.Types.ObjectId(videoId)
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: 'owner',
            pipeline : [
              {
                $project : {
                  _id : 1,
                  username : 1,
                  avatar : 1,
                }
              }
            ]
          }
        },
        {
          $addFields: {
            owner: {
              $first : "$owner"
            }
          }
        },
        {
          $sort : {
            createdAt : 1
          }
        }
      ])

      //option for aggregatePaginate
      const options ={
        page : parseInt(page),
        limit : parseInt(limit),
        customLabels : {
            totalDocs: 'totalComments',
            docs: 'comments',
        }
      }

      //   comment.aggregatePaginate for pagination
      Comment.aggregatePaginate(commentAggrigate , options , (err , result)=>{
        if(err){
            console.error("Error in aggregatePaginate:", err);
            throw new ApiError(500, err.message || "Internal server error in video aggregatePaginate");
        }
        // return the comments in the response
        return res.status(200)
            .json(new ApiResponse(200 , result , result.totalComments === 0 ? "No Comments Found" :"Comments fetched successfully"))
      })


})

const addComment = asyncHandler(async (req, res) => {
    // TODO: add a comment to a video
    
    // get videoId from params and validate object id
    const {videoId} = req.params;
    if(!isValidObjectId(videoId)){
        throw new ApiError(400 , "Invalid video id")
        }
        
    // get comment content from request body and validate its not empty
    const {content} = req.body;
    if(content.trim() === ""){
        throw new ApiError(404 , "Content is required")
    }

    // find video by id and validate its existence
    const video = await Video.findById(videoId , {_id : 1 , owner : 1})
    if(!video){
        throw new ApiError(404 , "Video not Found")
    }

    // find user by id and validate its existence
    const user = await User.findById(req.user?._id)
    if(!user){
        throw new ApiError(404 , "user not Found")
    }

    // create a new comment with content, video and owner
    const newComment = await Comment.create({
        content,
        video : video._id,
        owner : req.user?._id   
    })
    // if comment is not created successfully throw an error
    if(!newComment){
        throw new ApiError(500 , "Comment not added successfully")
    }

    // return the new comment in the response
    return res.status(200)
        .json(new ApiResponse(200 , newComment , "Comment added successfully"))

})

const updateComment = asyncHandler(async (req, res) => {
    // TODO: update a comment
    // get commentId from params and validate object id
    const {commentId} = req.params;
    if(!isValidObjectId(commentId)){
        throw new ApiError(400 , "Invalid video id")
    }

    // find comment by id and validate its existence
    const comment = await Comment.findById(commentId, {_id : 1 , owner : 1})
    if(!comment){
        throw new ApiError(404 , "Comment not found")
    }

    // check if the user is the owner of the comment
    if(comment?.owner?.toString() !== req.user?._id.toString()){
        throw new ApiError(403 , "You are not authorized to update this comment")
    }

    // get comment content from request body and validate its not empty
    const {content} = req.body;
    if(content.trim() === ""){
        throw new ApiError(404 , "Content is required")
    }

    // update the comment with the new content
    const updatedComment = await Comment.findByIdAndUpdate(commentId , {content} , {new : true})
    // if comment is not updated successfully throw an error
    if(!updatedComment){
        throw new ApiError(500 , "Comment not updated successfully")
    }
    
    // return the updated comment in the response
    return res.status(200)
        .json(new ApiResponse(200 , updatedComment , "Comment updated successfully"))


})

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment
    // get commentId from params and validate object id
    const {commentId} = req.params;
    if(!isValidObjectId(commentId)){
        throw new ApiError(400 , "Invalid comment id")
    }

    // find comment by id and validate its existence
    const comment = await Comment.findById(commentId , {_id : 1 , owner : 1})
    if(!comment){
        throw new ApiError(404 ,"comment not found")
    }

    // check if the user is the owner of the comment
    if(comment?.owner?._id.toString() !== req.user?._id.toString()){
        throw new ApiError(403 , "Not Authorized to perform this action")
    }

    // delete the comment from database and validate its deleted successfully
    const deleteComment = await Comment.findByIdAndDelete(commentId)
    if(!deleteComment){
        throw new ApiError(500 , "Comment not deleted successfully")
    }

    // return success message in the response
    return res.status(200)
        .json(new ApiResponse(200 , {} , "Comment Deleted Successfully"))

})

export {
    getVideoComments, 
    addComment, 
    updateComment,
     deleteComment
    }
