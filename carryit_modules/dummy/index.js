/**
 * @description Dummy Module
 * @author Fahid Mohammad
 */

 // Return Dummy Data
const dummyReturn = (args) => {
    return 'Hi Dummy, '+ args;
}

// Save Dummy Data
const dummySave = (args) =>{
    //TODO: Your logic to save Mongoose Modal Data
}

// Get Dummy Data
const dummyGet = (args) =>{
    //TODO: Your logic to get Mongoose Modal Data : Aggregation : find : findone etc..
}

module.exports = { 
    dummyReturn,
    dummySave,
    dummyGet,
};