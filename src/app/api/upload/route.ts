import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Ensure the uploads directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadDir, { recursive: true })

    // Generate a unique filename to prevent collisions
    const fileExtension = path.extname(file.name)
    const fileNameWithoutExt = path.basename(file.name, fileExtension)
      .replace(/[^a-zA-Z0-9]/g, '_') // sanitize name
    const uniqueFileName = `${Date.now()}-${fileNameWithoutExt}${fileExtension}`
    const filePath = path.join(uploadDir, uniqueFileName)

    // Write file to local public folder
    await writeFile(filePath, buffer)

    return NextResponse.json({
      success: true,
      url: `/uploads/${uniqueFileName}`,
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    })
  } catch (error) {
    console.error('Error handling upload:', error)
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    )
  }
}
