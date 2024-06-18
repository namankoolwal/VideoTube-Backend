import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { deleteFromCloudinary, deleteVideoFromCloudinary, uploadToCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 5, query="", sortBy, sortType, userId } = req.query;
  //TODO: get all videos based on query, sort, pagination

  // match the qury condition for both title and description
  const matchCondition = {
      $or : [
        {title : {$regex :query , $options : 'i'}},
        {description :{$regex : query , $options : 'i'}}
      ]
    }

    //  sets owner property of matchCondition to userId
    if(userId){
      matchCondition.owner = new mongoose.Types.ObjectId(userId),
      matchCondition.isPublished = true
    }

    // video.aggregate pipeline for matchingCondition and looking up in users collection
    let videoAggregate ;
    try {
      // dont use await b/c : - Using await with Video.aggregate([...]) would execute the aggregation pipeline immediately, preventing aggregatePaginate from modifying the pipeline for pagination. By not using await, you pass the unexecuted aggregation object to aggregatePaginate, allowing it to append additional stages and handle pagination correctly.
      videoAggregate = Video.aggregate([
        {
          $match :matchCondition
        },
        {
          $lookup : {
              from : "users",
              localField : "owner",
              foreignField : "_id",
              as : "owner",
              pipeline : [
                {
                  $project : {
                    _id : 1,
                    username : 1,
                    email : 1,
                    avatar : 1 
                  }
                }
              ]
          }
        },
        {
          $addFields :{
            owner : {
              $first : "$owner" 
            }
          }
        },
        {
          $sort : {
            [sortBy || "createdAt"] : sortType === "desc" ? -1 : 1
          }
        }
      ])
    }
    catch(err){
      console.error("Error in aggregation:", err);
        throw new ApiError(500, err.message || "Internal server error in video aggregate");

    }

    // options for aggregatePaginate
    const options = {
      page : parseInt(page),
      limit : parseInt(limit),
      customLabels :{
        totalDocs : "totalVideos",
        docs : "videos"
      }
    }
    
    // video.aggregatePaginate for pagination
    Video.aggregatePaginate(videoAggregate , options)
    .then((result) => {
       try {
          res.status(200)
            .json(new ApiResponse(200 , result , result.totalVideos === 0 ? "No video found" : "videos fetched successfully"))
       } catch (error) {
        console.error("Error in aggregatePaginate:", error);
        throw new ApiError(500, error.message || "Internal server error in video aggregatePaginate");

       }
})


});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  // TODO: get video, upload to cloudinary, create video

  const ownerId = req.user?._id;
  if (!ownerId) {
    throw new ApiError(401, "Invalid User");
  }
  if ([title, description].some((field) => field.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }
  const videoFileLocalPath = req.files?.videoFile[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

  if (!videoFileLocalPath || !thumbnailLocalPath) {
    throw new ApiError(400, "Video file and thumbnail are required");
  }

  const videoFile = await uploadToCloudinary(videoFileLocalPath);
  const thumbnail = await uploadToCloudinary(thumbnailLocalPath);

  if (!videoFile || !thumbnail) {
    throw new ApiError(
      500,
      "Failed to upload video and thumbnail to cloudinary"
    );
  }

  const newVideo = await Video.create({
    title,
    description,
    videoFile: { publicId: videoFile?.public_id, url: videoFile?.url },
    thumbnail: { publicId: thumbnail?.public_id, url: thumbnail?.url },
    owner: req.user?._id,
    duration: videoFile?.duration,
  });
  if (!newVideo) {
    throw new ApiError(500, "Something went wrong while uploading video");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, newVideo, "Video Published Successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id
  if (!isValidObjectId(videoId)) {
    throw new ApiError(401, "Invalid VideoId");
  }

  //   find video in video collection
  const videoFind = await Video.findById(videoId);
  if (!videoFind) {
    throw new ApiError(404, "Video not found");
  }

  // find owner of the video
  const userFind = await User.findById(req.user?._id, { watchhistory: 1 });
  if (!userFind) {
    throw new ApiError(404, "User not found");
  }

  // increment the view by one
  if (!userFind?.watchhistory.includes(videoId)) {
    await Video.findByIdAndUpdate(
      videoId,
      {
        $inc: {
          views: 1,
        },
      },
      { new: true }
    );
  }

  // add video to users watchHistory
  await User.findByIdAndUpdate(req.user?._id, {
    $addToSet: {
      watchhistory: videoId,
    },
  });

  // aggregation pipeline to get the video along with user details
  const video = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              username: 1,
              avatar: 1,
              email: 1,
              fullname: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        owner: {
          $first: "$owner",
        },
        videoFile: "$videoFile.url",
        thumbnail: "$thumbnail.url",
      },
    },
  ]);

  if (!video) {
    throw new ApiError(400, "video not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, video[0], "Video details fetched Succesfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
    //TODO: update video details like title, description, thumbnail
  const { videoId } = req.params;
  const {title , description} = req.body
  const thumbnailLocalPath = req.file?.path

  if(!isValidObjectId(videoId)){
    throw new ApiError(400 , "Video not Found")
  }

  if(!(title || description) || !thumbnailLocalPath){
    throw new ApiError (400 , "fields are required")
  }

//   find old video details and retun only thumbnail object
const oldVideoFind = await Video.findById(videoId , {thumbnail : 1})
if(!oldVideoFind){
    throw new ApiError(400, "old video not found")
}

const thumbnail = await uploadToCloudinary(thumbnailLocalPath)
if(!thumbnail){
    throw new ApiError(500, "An error occured while uploading thumbnail on cloudinary")
}
const video = await Video.findByIdAndUpdate(videoId, {
    $set : {
        title,
        description,
        thumbnail : {
            publicId : thumbnail?.public_id,
            url : thumbnail?.url
        }
    }
} , {new : true})

const deleteOldThumbnail = await deleteFromCloudinary(oldVideoFind?.thumbnail?.publicId);
if(!(deleteOldThumbnail.result === 'ok')){
    throw new ApiError(500 , "error while deleting old image")
}

return res.status(200)
            .json(new ApiResponse(200 , video , "Video Details updated Successfully"))

});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video

  if (!isValidObjectId(videoId)) {
    throw new ApiError(401, "Invalid VideoId");
  }
  
  // fetch video details
  const video = await Video.findById(videoId , {_id : 1 , owner : 1 , videoFile : 1 , thumbnail : 1});
  if(!video){
    throw new ApiError(404 , "Video not found")
  }

  // validate owner of the video
  if(video?.owner.toString() !== req.user?._id.toString()){
    throw new ApiError(401 , "You are not authorized to perform this action")
  }

  // delete video & thumbnail from cloudinary
  const deletedVideo = await deleteVideoFromCloudinary(video.videoFile.publicId);
  const deletedThumbnail = await deleteFromCloudinary(video.thumbnail.publicId);

  // check if video and thumbnail deleted successfully
  if(!(deletedVideo.result === 'ok') || !(deletedThumbnail.result === 'ok')){
    throw new ApiError(500 , "An error occured while deleting video")
  }

  // delete video from videos collection and remove video from users watch history
  await Video.findByIdAndDelete(videoId)
  await User.updateMany({watchhistory : videoId} , {$pull : {watchhistory : videoId} } , {new : true })

  // return response
  res.status(200)
    .json(new ApiResponse(200 ,{} , "Video Deleted Successfully" ))

  
});

const togglePublishStatus = asyncHandler(async (req, res) => {

  const { videoId } = req.params;  
  
  if(!isValidObjectId(videoId)){
    throw new ApiError(400 , "Invalid Video")
  }

  // fetch video details
  const video = await Video.findById(videoId, {_id: 1 , isPublished : 1 , owner : 1})
  if(!video){
    throw new ApiError(404, "video not found")
  }

  // validate owner of the video
  if(video?.owner.toString() !== req.user?._id.toString()){
    throw new ApiError(401 , "You are not authorized to perform this action")
  }

  // update video publish status
  const updatedVideo = await Video.findByIdAndUpdate(videoId , {isPublished : !video?.isPublished} , {new : true})

  if(!updatedVideo){
    throw new ApiError(500 , "An error occured while updating video publish Status")
  }
  // return response
 res.status(200)
      .json(new ApiResponse(200 , updatedVideo , updatedVideo.isPublished ? "Video Published" : "Video Unpublished"))
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};



