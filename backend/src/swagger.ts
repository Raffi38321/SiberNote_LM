import swaggerJSDoc from "swagger-jsdoc"

const options: swaggerJSDoc.Options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "SiberNote LM API",
            version: "1.0.0",
            description: "Dokumentasi API untuk SiberNote LM — aplikasi catatan berbasis AI dengan fitur RAG (Retrieval-Augmented Generation).",
        },
        servers: [
            { url: "http://localhost:8080", description: "Development" },
            { url: "http://43.129.49.191:8080", description: "Production" },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
            schemas: {
                // ─── common ───────────────────────────────────────────────
                SuccessResponse: {
                    type: "object",
                    properties: {
                        status: { type: "string", example: "success" },
                        message: { type: "string" },
                    },
                },
                ErrorResponse: {
                    type: "object",
                    properties: {
                        status: { type: "string", example: "failed" },
                        message: { type: "string" },
                    },
                },
                ValidationErrorResponse: {
                    type: "object",
                    properties: {
                        status: { type: "string", example: "failed" },
                        message: { type: "string", example: "validasi gagal" },
                        errors: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    field: { type: "string" },
                                    message: { type: "string" },
                                },
                            },
                        },
                    },
                },
                // ─── user ─────────────────────────────────────────────────
                User: {
                    type: "object",
                    properties: {
                        _id: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
                        email: { type: "string", example: "raffi@example.com" },
                        username: { type: "string", example: "raffi" },
                        avatarUrl: { type: "string", example: "https://storage.sibernote.com/avatars/avatar.jpg" },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                    },
                },
                // ─── notebook ─────────────────────────────────────────────
                Notebook: {
                    type: "object",
                    properties: {
                        _id: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0e" },
                        userId: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
                        title: { type: "string", example: "Catatan Belajar" },
                        description: { type: "string", example: "Kumpulan catatan belajar machine learning" },
                        isPinned: { type: "boolean", example: false },
                        jumlah_sumber: { type: "number", example: 3 },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                    },
                },
                Pagination: {
                    type: "object",
                    properties: {
                        page: { type: "number", example: 1 },
                        limit: { type: "number", example: 10 },
                        totalNotebook: { type: "number", example: 25 },
                        totalPages: { type: "number", example: 3 },
                        hasNextPage: { type: "boolean", example: true },
                        hasPrevPage: { type: "boolean", example: false },
                    },
                },
                // ─── document ─────────────────────────────────────────────
                Document: {
                    type: "object",
                    properties: {
                        _id: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0f" },
                        notebookId: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0e" },
                        title: { type: "string", example: "Sistem_Operasi" },
                        fileType: { type: "string", enum: ["pdf", "pptx", "docx", "txt"], example: "pdf" },
                        fileUrl: { type: "string", example: "https://storage.sibernote.com/documents/Sistem_Operasi.pdf" },
                        fileSize: { type: "number", example: 2048576 },
                        totalPages: { type: "number", example: 42 },
                        parseStatus: { type: "string", enum: ["pending", "done", "error"], example: "done" },
                        parseError: { type: "string", example: "" },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                    },
                },
                // ─── note ─────────────────────────────────────────────────
                Note: {
                    type: "object",
                    properties: {
                        _id: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c10" },
                        notebookId: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0e" },
                        title: { type: "string", example: "Ringkasan Bab 1" },
                        content: { type: "string", example: "Isi catatan di sini..." },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                    },
                },
                // ─── chat ─────────────────────────────────────────────────
                Citation: {
                    type: "object",
                    properties: {
                        citationIndex: { type: "number", example: 1 },
                        documentId: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0f" },
                        documentTitle: { type: "string", example: "Sistem_Operasi" },
                        pageStart: { type: "number", example: 31 },
                        pageEnd: { type: "number", example: 33 },
                        chunkContent: { type: "string", example: "Virtual memory adalah mekanisme yang memungkinkan..." },
                    },
                },
                Message: {
                    type: "object",
                    properties: {
                        _id: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c20" },
                        notebookId: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0e" },
                        role: { type: "string", enum: ["user", "assistant"], example: "assistant" },
                        content: { type: "string", example: "Virtual memory adalah mekanisme yang memungkinkan sistem operasi menggunakan storage sebagai perpanjangan RAM [1]." },
                        citations: { type: "array", items: { $ref: "#/components/schemas/Citation" } },
                        sourceType: {
                            type: "string",
                            nullable: true,
                            enum: ["document", "ai", "mixed", null],
                            example: "document",
                        },
                        createdAt: { type: "string", format: "date-time" },
                    },
                },
            },
        },
        paths: {
            // ═══════════════════════════════════════════════════════════════
            // AUTH
            // ═══════════════════════════════════════════════════════════════
            "/user/register": {
                post: {
                    tags: ["Auth"],
                    summary: "Register akun baru",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["email", "username", "password"],
                                    properties: {
                                        email: { type: "string", format: "email", example: "raffi@example.com" },
                                        username: { type: "string", minLength: 1, maxLength: 16, example: "raffi" },
                                        password: { type: "string", minLength: 8, maxLength: 16, example: "rahasia123" },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        201: {
                            description: "Berhasil register",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            status: { type: "string", example: "success" },
                                            message: { type: "string", example: "berhasil buat user" },
                                            data: {
                                                type: "object",
                                                properties: {
                                                    accessToken: { type: "string" },
                                                    refreshToken: { type: "string" },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        400: { description: "Validasi gagal", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationErrorResponse" } } } },
                        401: { description: "Email atau username sudah terdaftar", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Kesalahan server", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
            },
            "/user/login": {
                post: {
                    tags: ["Auth"],
                    summary: "Login",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["email", "password"],
                                    properties: {
                                        email: { type: "string", format: "email", example: "raffi@example.com" },
                                        password: { type: "string", example: "rahasia123" },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        200: {
                            description: "Berhasil login",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            status: { type: "string", example: "success" },
                                            message: { type: "string", example: "berhasil login" },
                                            data: {
                                                type: "object",
                                                properties: {
                                                    accessToken: { type: "string" },
                                                    refreshToken: { type: "string" },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        400: { description: "Validasi gagal", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationErrorResponse" } } } },
                        401: { description: "Email atau password salah", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Kesalahan server", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
            },
            "/user/refresh": {
                post: {
                    tags: ["Auth"],
                    summary: "Refresh access token",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["refreshToken"],
                                    properties: {
                                        refreshToken: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        200: {
                            description: "Access token baru",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            status: { type: "string", example: "success" },
                                            message: { type: "string", example: "access token berhasil diperbarui" },
                                            data: {
                                                type: "object",
                                                properties: { accessToken: { type: "string" } },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        401: { description: "Refresh token tidak valid atau tidak dikirim", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Kesalahan server", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
            },
            "/user/logout": {
                post: {
                    tags: ["Auth"],
                    summary: "Logout — cabut refresh token",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["refreshToken"],
                                    properties: { refreshToken: { type: "string" } },
                                },
                            },
                        },
                    },
                    responses: {
                        200: { description: "Berhasil logout", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
                        401: { description: "Refresh token tidak dikirim", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Kesalahan server", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
            },
            // ═══════════════════════════════════════════════════════════════
            // USER
            // ═══════════════════════════════════════════════════════════════
            "/user/me": {
                get: {
                    tags: ["User"],
                    summary: "Get data user yang sedang login",
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: {
                            description: "Data user",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            status: { type: "string", example: "success" },
                                            message: { type: "string" },
                                            data: {
                                                type: "object",
                                                properties: { user: { $ref: "#/components/schemas/User" } },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        401: { description: "Tidak terautentikasi", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        404: { description: "User tidak ditemukan", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Kesalahan server", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
            },
            "/user": {
                put: {
                    tags: ["User"],
                    summary: "Update profil — username dan/atau foto avatar",
                    description: "Minimal salah satu dari `username` atau `avatar` harus diisi. Format avatar hanya JPG, maksimal 5 MB.",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "multipart/form-data": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        username: { type: "string", minLength: 1, maxLength: 16 },
                                        avatar: { type: "string", format: "binary" },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        200: {
                            description: "Profil berhasil diperbarui",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            status: { type: "string", example: "success" },
                                            message: { type: "string", example: "Profil berhasil diperbarui" },
                                            data: {
                                                type: "object",
                                                properties: { user: { $ref: "#/components/schemas/User" } },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        400: { description: "Validasi gagal / format avatar salah / tidak ada field", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        401: { description: "Tidak terautentikasi / username sudah terdaftar", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Kesalahan server", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
            },
            // ═══════════════════════════════════════════════════════════════
            // NOTEBOOKS
            // ═══════════════════════════════════════════════════════════════
            "/notebooks": {
                post: {
                    tags: ["Notebooks"],
                    summary: "Buat notebook baru",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["title", "description"],
                                    properties: {
                                        title: { type: "string", maxLength: 100, example: "Catatan Belajar" },
                                        description: { type: "string", example: "Kumpulan catatan belajar machine learning" },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        201: {
                            description: "Notebook berhasil dibuat",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            status: { type: "string", example: "success" },
                                            message: { type: "string" },
                                            data: {
                                                type: "object",
                                                properties: { notebook: { $ref: "#/components/schemas/Notebook" } },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        400: { description: "Validasi gagal", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationErrorResponse" } } } },
                        401: { description: "Tidak terautentikasi", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Kesalahan server", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
                get: {
                    tags: ["Notebooks"],
                    summary: "Get semua notebook milik user (dengan pagination)",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            in: "query",
                            name: "page",
                            schema: { type: "integer", default: 1 },
                            description: "Nomor halaman, limit 10 per halaman",
                        },
                    ],
                    responses: {
                        200: {
                            description: "Daftar notebook",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            status: { type: "string", example: "success" },
                                            message: { type: "string" },
                                            data: {
                                                type: "object",
                                                properties: {
                                                    notebooks: { type: "array", items: { $ref: "#/components/schemas/Notebook" } },
                                                    pagination: { $ref: "#/components/schemas/Pagination" },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        401: { description: "Tidak terautentikasi", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Kesalahan server", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
            },
            "/notebooks/{notebookId}": {
                get: {
                    tags: ["Notebooks"],
                    summary: "Get notebook by ID beserta notes dan documents",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "notebookId", required: true, schema: { type: "string" } }],
                    responses: {
                        200: {
                            description: "Detail notebook",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            status: { type: "string", example: "success" },
                                            message: { type: "string" },
                                            data: {
                                                type: "object",
                                                properties: {
                                                    notebook: { $ref: "#/components/schemas/Notebook" },
                                                    notes: { type: "array", items: { $ref: "#/components/schemas/Note" } },
                                                    documents: { type: "array", items: { $ref: "#/components/schemas/Document" } },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        401: { description: "Tidak terautentikasi", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        404: { description: "Notebook tidak ditemukan atau bukan milik user", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Kesalahan server", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
                put: {
                    tags: ["Notebooks"],
                    summary: "Update judul atau deskripsi notebook",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "notebookId", required: true, schema: { type: "string" } }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        title: { type: "string", maxLength: 100 },
                                        description: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        200: { description: "Notebook berhasil diupdate", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" }, message: { type: "string" }, data: { type: "object", properties: { notebook: { $ref: "#/components/schemas/Notebook" } } } } } } } },
                        400: { description: "Validasi gagal", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationErrorResponse" } } } },
                        401: { description: "Tidak terautentikasi", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        404: { description: "Notebook tidak ditemukan atau bukan milik user", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Kesalahan server", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
                delete: {
                    tags: ["Notebooks"],
                    summary: "Hapus notebook beserta semua dokumen, chunks, notes, dan messages",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "notebookId", required: true, schema: { type: "string" } }],
                    responses: {
                        200: { description: "Berhasil hapus", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
                        401: { description: "Tidak terautentikasi", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        404: { description: "Notebook tidak ditemukan atau bukan milik user", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Kesalahan server", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
            },
            "/notebooks/{notebookId}/pin": {
                patch: {
                    tags: ["Notebooks"],
                    summary: "Pin atau unpin notebook",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "notebookId", required: true, schema: { type: "string" } }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["pinned"],
                                    properties: { pinned: { type: "boolean", example: true } },
                                },
                            },
                        },
                    },
                    responses: {
                        200: { description: "Status pin berhasil diubah", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" }, message: { type: "string" }, data: { type: "object", properties: { notebook: { $ref: "#/components/schemas/Notebook" } } } } } } } },
                        400: { description: "Validasi gagal", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationErrorResponse" } } } },
                        401: { description: "Tidak terautentikasi", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        404: { description: "Notebook tidak ditemukan atau bukan milik user", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Kesalahan server", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
            },
            // ═══════════════════════════════════════════════════════════════
            // NOTES
            // ═══════════════════════════════════════════════════════════════
            "/notes/{notebookId}": {
                post: {
                    tags: ["Notes"],
                    summary: "Buat note baru di dalam notebook",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "notebookId", required: true, schema: { type: "string" } }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["title", "content"],
                                    properties: {
                                        title: { type: "string", minLength: 1, maxLength: 100, example: "Ringkasan Bab 1" },
                                        content: { type: "string", example: "Isi catatan di sini..." },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        201: { description: "Note berhasil dibuat", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" }, message: { type: "string" }, data: { type: "object", properties: { note: { $ref: "#/components/schemas/Note" } } } } } } } },
                        400: { description: "Validasi gagal", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationErrorResponse" } } } },
                        401: { description: "Tidak terautentikasi", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        404: { description: "Notebook tidak ditemukan atau bukan milik user", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Kesalahan server", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
            },
            "/notes/{notebookId}/all": {
                get: {
                    tags: ["Notes"],
                    summary: "Get semua note dalam notebook",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "notebookId", required: true, schema: { type: "string" } }],
                    responses: {
                        200: { description: "Daftar note", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" }, message: { type: "string" }, data: { type: "object", properties: { notes: { type: "array", items: { $ref: "#/components/schemas/Note" } } } } } } } } },
                        401: { description: "Tidak terautentikasi", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        404: { description: "Notebook tidak ditemukan atau bukan milik user", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Kesalahan server", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
            },
            "/notes/{notebookId}/{noteId}": {
                get: {
                    tags: ["Notes"],
                    summary: "Get note by ID",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { in: "path", name: "notebookId", required: true, schema: { type: "string" } },
                        { in: "path", name: "noteId", required: true, schema: { type: "string" } },
                    ],
                    responses: {
                        200: { description: "Detail note", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" }, message: { type: "string" }, data: { type: "object", properties: { note: { $ref: "#/components/schemas/Note" } } } } } } } },
                        401: { description: "Tidak terautentikasi", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        404: { description: "Note tidak ditemukan", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Kesalahan server", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
                put: {
                    tags: ["Notes"],
                    summary: "Update note",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { in: "path", name: "notebookId", required: true, schema: { type: "string" } },
                        { in: "path", name: "noteId", required: true, schema: { type: "string" } },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        title: { type: "string", minLength: 1, maxLength: 100 },
                                        content: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        200: { description: "Note berhasil diupdate", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" }, message: { type: "string" }, data: { type: "object", properties: { note: { $ref: "#/components/schemas/Note" } } } } } } } },
                        400: { description: "Validasi gagal", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationErrorResponse" } } } },
                        401: { description: "Tidak terautentikasi", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        404: { description: "Note tidak ditemukan", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Kesalahan server", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
                delete: {
                    tags: ["Notes"],
                    summary: "Hapus note",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { in: "path", name: "notebookId", required: true, schema: { type: "string" } },
                        { in: "path", name: "noteId", required: true, schema: { type: "string" } },
                    ],
                    responses: {
                        200: { description: "Note berhasil dihapus", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
                        401: { description: "Tidak terautentikasi", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        404: { description: "Note tidak ditemukan", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Kesalahan server", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
            },
            // ═══════════════════════════════════════════════════════════════
            // DOCUMENTS
            // ═══════════════════════════════════════════════════════════════
            "/documents/{notebookId}": {
                post: {
                    tags: ["Documents"],
                    summary: "Upload dokumen (PDF, PPTX, DOCX, TXT)",
                    description: "File disimpan ke storage server. Chunking dan embedding berjalan di background. Polling `GET /documents/status/:documentId` untuk cek status.",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "notebookId", required: true, schema: { type: "string" } }],
                    requestBody: {
                        required: true,
                        content: {
                            "multipart/form-data": {
                                schema: {
                                    type: "object",
                                    required: ["file"],
                                    properties: {
                                        file: { type: "string", format: "binary", description: "PDF, PPTX, DOCX, atau TXT — maksimal 20MB" },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        201: { description: "Dokumen terupload, proses background dimulai", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" }, message: { type: "string" }, data: { type: "object", properties: { document: { $ref: "#/components/schemas/Document" } } } } } } } },
                        401: { description: "Tidak terautentikasi / tipe file tidak didukung / file tidak disertakan", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        404: { description: "Notebook tidak ditemukan atau bukan milik user", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Kesalahan server / gagal upload", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
                get: {
                    tags: ["Documents"],
                    summary: "Get semua dokumen dalam notebook",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "notebookId", required: true, schema: { type: "string" } }],
                    responses: {
                        200: { description: "Daftar dokumen", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" }, message: { type: "string" }, data: { type: "object", properties: { documents: { type: "array", items: { $ref: "#/components/schemas/Document" } } } } } } } } },
                        401: { description: "Tidak terautentikasi", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        404: { description: "Notebook tidak ditemukan atau bukan milik user", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Kesalahan server", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
            },
            "/documents/{documentId}": {
                patch: {
                    tags: ["Documents"],
                    summary: "Update judul dokumen",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "documentId", required: true, schema: { type: "string" } }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["name"],
                                    properties: { name: { type: "string", example: "Sistem Operasi — Bab 3" } },
                                },
                            },
                        },
                    },
                    responses: {
                        200: { description: "Judul berhasil diupdate", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" }, message: { type: "string" }, data: { type: "object", properties: { document: { $ref: "#/components/schemas/Document" } } } } } } } },
                        400: { description: "Validasi gagal", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationErrorResponse" } } } },
                        401: { description: "Tidak terautentikasi", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        404: { description: "Dokumen tidak ditemukan", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Kesalahan server", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
                delete: {
                    tags: ["Documents"],
                    summary: "Hapus dokumen beserta chunks dan file di storage",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "documentId", required: true, schema: { type: "string" } }],
                    responses: {
                        200: { description: "Dokumen berhasil dihapus", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
                        401: { description: "Tidak terautentikasi", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        403: { description: "Dokumen bukan milik user", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        404: { description: "Dokumen tidak ditemukan", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Kesalahan server", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
            },
            "/documents/status/{documentId}": {
                get: {
                    tags: ["Documents"],
                    summary: "Polling status pemrosesan dokumen",
                    description: "Gunakan endpoint ini untuk cek apakah chunking + embedding sudah selesai. Poll sampai `parseStatus` bukan `pending`.",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "documentId", required: true, schema: { type: "string" } }],
                    responses: {
                        200: {
                            description: "Status dokumen",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            status: { type: "string", example: "success" },
                                            message: { type: "string" },
                                            data: {
                                                type: "object",
                                                properties: {
                                                    parseStatus: { type: "string", enum: ["pending", "done", "error"] },
                                                    parseError: { type: "string" },
                                                    totalPages: { type: "number" },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        401: { description: "Tidak terautentikasi", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        403: { description: "Dokumen bukan milik user", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        404: { description: "Dokumen tidak ditemukan", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Kesalahan server", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
            },
            // ═══════════════════════════════════════════════════════════════
            // CHAT AI
            // ═══════════════════════════════════════════════════════════════
            "/chat/{notebookId}": {
                get: {
                    tags: ["Chat AI"],
                    summary: "Get riwayat percakapan notebook",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "notebookId", required: true, schema: { type: "string" } }],
                    responses: {
                        200: {
                            description: "Riwayat pesan",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            status: { type: "string", example: "success" },
                                            message: { type: "string" },
                                            data: {
                                                type: "object",
                                                properties: {
                                                    messages: { type: "array", items: { $ref: "#/components/schemas/Message" } },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        401: { description: "Tidak terautentikasi", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        404: { description: "Notebook tidak ditemukan atau bukan milik user", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Kesalahan server", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
                post: {
                    tags: ["Chat AI"],
                    summary: "Kirim pesan — jalankan pipeline RAG",
                    description: "Embed pertanyaan → vector search top-8 chunks → prompt ke Gemini → simpan user + assistant message → return keduanya. Pastikan minimal 1 dokumen sudah `parseStatus: done`.",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "notebookId", required: true, schema: { type: "string" } }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["message"],
                                    properties: {
                                        message: { type: "string", minLength: 1, example: "Apa itu virtual memory?" },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        200: {
                            description: "Jawaban AI beserta citations",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            status: { type: "string", example: "success" },
                                            message: { type: "string", example: "berhasil kirim pesan" },
                                            data: {
                                                type: "object",
                                                properties: {
                                                    userMessage: { $ref: "#/components/schemas/Message" },
                                                    assistantMessage: { $ref: "#/components/schemas/Message" },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        400: { description: "Validasi gagal (message kosong)", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationErrorResponse" } } } },
                        401: { description: "Tidak terautentikasi", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        404: { description: "Notebook tidak ditemukan atau bukan milik user", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        422: { description: "Tidak ada dokumen dengan parseStatus done di notebook ini", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                        500: { description: "Gagal mendapatkan jawaban, silakan coba lagi.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                    },
                },
            },
        },
    },
    apis: [],
}

const swaggerSpec = swaggerJSDoc(options)

export default swaggerSpec
