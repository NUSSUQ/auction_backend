const fs = require("fs");
const path = require("path");

const deleteFiles = (files) => {
    files.forEach((file) => {
        const filePath = path.resolve(__dirname, "..", file);

        // Check if the file exists before attempting to delete it
        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                console.error(`File not found: ${filePath}`);
            } else {
                fs.unlink(filePath, (err) => {
                    if (err) {
                        console.error(`Error deleting file: ${filePath}`);
                    } else {
                        console.log(`Successfully deleted file: ${filePath}`);
                    }
                });
            }
        });
    });
};

module.exports = deleteFiles;
