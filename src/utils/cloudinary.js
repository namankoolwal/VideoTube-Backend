import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    // upload file to cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    // file has been uploaded
    // console.log("File uploaded successfully on cloudinary " , response.url)
    // console.log("cloudinary" , response)
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath); // removes the locally uploaded file as the upload operation failed
    return null;
  }
};

const deleteFromCloudinary = async (fileToDelete) => {
 try {
    const response =  await cloudinary.uploader.destroy(fileToDelete , {
      resource_type: "image"
    });
    return response
 } catch (error) {
    return null
 }
};

const deleteVideoFromCloudinary = async (fileToDelete) => {
  try {
     const response =  await cloudinary.uploader.destroy(fileToDelete , {
       resource_type: "video"
     });
     return response
  } catch (error) {
     return null
  }
 };

export { uploadToCloudinary, deleteFromCloudinary ,deleteVideoFromCloudinary};
