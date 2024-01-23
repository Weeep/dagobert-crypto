// import BinanceAPI from "./BinanceAPI";

// class BinanceRequester {
//     public static async makeAuthenticatedRequest(): Promise<void> {
//       const apiKey = 'wHI8QhwsZIbSESD9bVmkk8GYD7Vx8Kq6Jw5b1R5mAHkuV8NqnC64peSgCVCNOAcJ';
//       const apiSecret = 'KMBJ6Hxw5Tjuf7h3u8BehdeFeRlLBgaffcZm79VLGWz6XETSmGpA8obhuXnmCKr6';
  
//       BinanceAPI.auth(apiKey, apiSecret);
  
//       try {
//         const result = await BinanceAPI.call('/api/v3/account');
//         console.log('Authenticated Request Result:', result);
//       } catch (error) {
//         console.error('Error making authenticated request:', error.message);
//       }
//     }
  
//     public static async makePublicRequest(): Promise<void> {
//       try {
//         const result = await BinanceAPI.call('/api/v3/ticker/price');
//         console.log('Public Request Result:', result);
//       } catch (error) {
//         console.error('Error making public request:', error.message);
//       }
//     }
//   }
  
//   export default BinanceRequester;
  