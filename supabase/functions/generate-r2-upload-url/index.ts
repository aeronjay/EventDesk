import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.504.0"
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.504.0"
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { files } = await req.json() // Expecting: { files: [{ name: 'file.pdf', contentType: 'application/pdf' }] }
    
    if (!files || !Array.isArray(files)) {
      throw new Error('Invalid files array')
    }

    const accountId = Deno.env.get('R2_ACCOUNT_ID')
    const bucketName = Deno.env.get('R2_BUCKET_NAME')
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')

    if (!accountId || !bucketName || !accessKeyId || !secretAccessKey) {
      throw new Error('Missing R2 configuration in environment variables')
    }

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })

    const results = await Promise.all(
      files.map(async (f: { name: string; contentType: string }) => {
        // Generate a unique filename and place it in an 'attachments' folder
        const ext = f.name.split('.').pop()
        const uniqueKey = `attachments/${crypto.randomUUID()}.${ext}`

        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: uniqueKey,
          ContentType: f.contentType,
        })

        // Generate the presigned URL valid for 5 minutes (300 seconds)
        const url = await getSignedUrl(s3, command, { expiresIn: 300 })
        const publicBaseUrl = Deno.env.get('R2_PUBLIC_URL') || `https://pub-xxxx.r2.dev`

        return {
          originalName: f.name,
          key: uniqueKey,
          uploadUrl: url,
          url: `${publicBaseUrl}/${uniqueKey}`
        }
      })
    )

    return new Response(
      JSON.stringify({ urls: results }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
