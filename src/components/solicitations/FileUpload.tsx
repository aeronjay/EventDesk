import React, { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabaseClient'
import { UploadCloud, X, File, Loader2, FileText, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface Attachment {
  name: string
  url: string
  key: string
}

interface FileUploadProps {
  attachments: Attachment[]
  onChange: (attachments: Attachment[]) => void
  disabled?: boolean
}

interface UploadingFile {
  id: string
  file: File
  progress: number
  error?: string
}

export function FileUpload({ attachments, onChange, disabled }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return

    const files = Array.from(e.dataTransfer.files)
    await processFiles(files)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return
    if (e.target.files) {
      const files = Array.from(e.target.files)
      await processFiles(files)
      e.target.value = '' // Reset input
    }
  }

  const processFiles = async (files: File[]) => {
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    const validFiles = files.filter(f => validTypes.includes(f.type))

    if (validFiles.length < files.length) {
      toast.error('Some files were ignored. Only images, PDF, and DOCX are allowed.')
    }

    if (validFiles.length === 0) return

    const newUploads = validFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      progress: 0
    }))

    setUploadingFiles(prev => [...prev, ...newUploads])

    for (const upload of newUploads) {
      await uploadFile(upload)
    }
  }

  const uploadFile = async (upload: UploadingFile) => {
    try {
      // 1. Get presigned URL
      const { data, error } = await supabase.functions.invoke('generate-r2-upload-url', {
        body: { files: [{ name: upload.file.name, contentType: upload.file.type }] }
      })

      if (error) throw new Error(error.message)
      if (!data?.urls || data.urls.length === 0) throw new Error('Failed to get upload URL')

      const { uploadUrl, url, key } = data.urls[0]

      // 2. Upload to R2 directly
      setUploadingFiles(prev => prev.map(f => f.id === upload.id ? { ...f, progress: 20 } : f))

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: upload.file,
        headers: {
          'Content-Type': upload.file.type
        }
      })

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`)
      }

      setUploadingFiles(prev => prev.map(f => f.id === upload.id ? { ...f, progress: 100 } : f))

      // 3. Add to attachments
      const newAttachment: Attachment = { name: upload.file.name, url, key }
      onChange([...attachments, newAttachment])

      // Remove from uploading state after a short delay
      setTimeout(() => {
        setUploadingFiles(prev => prev.filter(f => f.id !== upload.id))
      }, 500)

    } catch (err: any) {
      console.error('Upload error:', err)
      toast.error(`Failed to upload ${upload.file.name}: ${err.message}`)
      setUploadingFiles(prev => prev.map(f => f.id === upload.id ? { ...f, error: err.message } : f))
    }
  }

  const handleRemove = (index: number) => {
    const updated = [...attachments]
    updated.splice(index, 1)
    onChange(updated)
  }

  const getFileIcon = (name: string) => {
    if (name.endsWith('.pdf')) return <FileText className="w-4 h-4 text-red-500" />
    if (name.match(/\.(jpeg|jpg|png|gif)$/i)) return <ImageIcon className="w-4 h-4 text-blue-500" />
    return <File className="w-4 h-4 text-primary" />
  }

  return (
    <div className="space-y-4 w-full">
      <div 
        className={cn(
          "relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-muted/20 transition-colors",
          isDragging ? "border-primary bg-primary/10" : "border-border",
          disabled && "opacity-50 pointer-events-none cursor-not-allowed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          multiple
          className="hidden" 
          ref={fileInputRef}
          accept="image/*,.pdf,.docx"
          onChange={handleFileSelect}
          disabled={disabled}
        />
        <div className="flex flex-col items-center justify-center space-y-2 text-center cursor-pointer">
          <div className="p-3 bg-background rounded-full shadow-sm border">
            <UploadCloud className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">
            <span className="text-primary">Click to upload</span> or drag and drop
          </div>
          <p className="text-xs text-muted-foreground">
            Image, PDF, or DOCX up to 10MB each
          </p>
        </div>
      </div>

      {(attachments.length > 0 || uploadingFiles.length > 0) && (
        <div className="flex flex-col gap-2">
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center justify-between p-2 border rounded-md bg-card shadow-sm">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="shrink-0 p-2 bg-muted rounded-md">
                  {getFileIcon(att.name)}
                </div>
                <div className="truncate text-sm font-medium max-w-[200px] sm:max-w-[300px]">
                  {att.name}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href={att.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                  View
                </a>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleRemove(i)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {uploadingFiles.map(f => (
            <div key={f.id} className="flex items-center justify-between p-2 border rounded-md bg-card shadow-sm opacity-70">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="shrink-0 p-2 bg-muted rounded-md">
                  {f.progress === 100 ? getFileIcon(f.file.name) : <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                </div>
                <div className="flex flex-col">
                  <div className="truncate text-sm font-medium max-w-[200px] sm:max-w-[300px]">
                    {f.file.name}
                  </div>
                  {f.error ? (
                    <span className="text-xs text-destructive">{f.error}</span>
                  ) : (
                    <div className="w-full h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-primary transition-all duration-300" style={{ width: `${f.progress}%` }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
