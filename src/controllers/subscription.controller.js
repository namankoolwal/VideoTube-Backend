import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import asyncHandler from "../utils/asyncHandler.js"



const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    
    if(!isValidObjectId(channelId)){
        throw new ApiError(401 , "Invalid channel id")
    }
    const subscriberId = req.user?._id
    if(!subscriberId){
        throw new ApiError(401, "Invalid User")
    }
    // TODO: toggle subscription
    const isSubscribed = await Subscription.findOne({subscriber : subscriberId , channel : channelId})
    let response
    try {
        response =  isSubscribed 
        ? await Subscription.deleteOne({subscriber : subscriberId , channel : channelId})
        : await Subscription.create({subscriber : subscriberId , channel : channelId})
    } catch (error) {
        console.log("toggleSubscriptionError :: " , error)
        throw new ApiError(500, error?.message || "Internal server Error")
    }

    return res.status(200)
    .json( new ApiResponse(200 , response , isSubscribed === null ? "subscribed Succesfully" : "unsubscribed Sucessfully" ))
})

// controller to return subscriber list of a channel //channel ke kitne subscribers hai - ksi channel ke subscriber count krne hai toh subscription models mai total no of this channel count krne honge
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {subscriberId} = req.params
    if(!isValidObjectId(subscriberId)){
        throw new ApiError(401, "invalid channel Id")
    }

    const channelSubscriber = await Subscription.aggregate([
        {
            $match :{                
                // This field ('channel') contains IDs of various channels. By querying this field with a specific 'subscriberId',
                // we can retrieve all documents that match the given subscriber's ID. This allows us to gather relevant information 
                channel : new mongoose.Types.ObjectId(subscriberId) 
            }
        },
        {
            $lookup :{
                from : "users",
                localField : "subscriber",// Next, we will look up the subscriber IDs in the user collection. We are querying the 'subscriber' field because it contains the ID of the subscriber who has subscribed to this channel. From the user collection, we are retrieving the username, full name, and avatar of these subscribers. This allows us to gather additional information about the subscribers associated with the channel.
                foreignField: '_id',
                as : "subscriber",
                pipeline: [
                    {
                        $project :{
                            username: 1,
                            fullname: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                subscriber: {
                    $first: "$subscriber",
                },
            },
        },
        
       
    ])

    const subscribersList = channelSubscriber.map((item)=> item.subscriber)
    return res.status(200)
    .json(new ApiResponse(200 , subscribersList , "subscriberlist fetched successfully"))
})

// controller to return channel list to which user has subscribed //user ne kitne channels ko subscribe kiya hua hai
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { channelId } = req.params

    if(!isValidObjectId(channelId)){
        throw new ApiError(401 , "Invalid channel")
    }

    const channelSubscribedTo = await Subscription.aggregate([
       { 
        $match :{
            subscriber : new mongoose.Types.ObjectId(channelId)
        }
    },
    {
        $lookup : {
            from : "users",
            localField: "channel" ,
            foreignField :"_id",
            as : "subscribedto",
            pipeline :[
                {
                    $project : {
                        username : 1,
                        fullname: 1,
                        avatar : 1
                    }
                }
            ]
        }
    }, 
    {
        $project :{
            subscribedto : {
                $first : "$subscribedto"
            }
        }
    }
    // {
    //     $unwind : "$subscribedto"
    // }
    ])

    const subscribedToList = channelSubscribedTo.map((item)=> item.subscribedto)
    return res.status(200)
    .json(new ApiResponse (200 , subscribedToList , "subscribedto list fetched succesfully"))
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}