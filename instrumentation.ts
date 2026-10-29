import type {Instrumentation} from 'next';
export const onRequestError:Instrumentation.onRequestError=async(error,request)=>{
 if(process.env.NEXT_RUNTIME==='nodejs')try{const {recordError}=await import('./lib/monitoring');await recordError(error,request.path,'server');}catch{console.error('A server error occurred; persistent monitoring was unavailable.');}
};
