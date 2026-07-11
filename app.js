document.addEventListener('DOMContentLoaded', async () => {
    const SUPABASE_URL = 'https://hxdagxcknmufpqoywmdn.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_QAGi1O6Vugv3jk7Bn6NcdQ_wtKj6OyF';
    console.log("My URL is:", SUPABASE_URL);
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('file-input');
    const uploadCard = document.getElementById('upload-card');
    const loadingState = document.getElementById('loading-state');
    const bookWrapper = document.getElementById('book-wrapper');
    const flipBook = document.getElementById('flip-book');
    const shareCard = document.getElementById('share-card');
    const shareUrlInput = document.getElementById('share-url');
    const copyBtn = document.getElementById('copy-btn');

    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

    let supabase;
    if (SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_URL !== '') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    // ROUTING ENGINE: Check for an ID in the URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get('book');

    if (bookId && supabase) {
        try {
            const { data: document, error } = await supabase
                .from('pdf_documents')
                .select('file_url')
                .eq('id', bookId)
                .single();

            if (document && !error) {
                uploadCard.style.display = 'none';
                await buildRenderPipeline(document.file_url);
                return;
            } else {
                alert('Document not found or link has expired.');
            }
        } catch (err) {
            console.error("Routing failed:", err);
        }
    }

    // UPLOAD LOGIC
    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', async (event) => {
        if (!supabase) {
            alert('Backend connection missing. Configure your Supabase credentials.');
            return;
        }

        const file = event.target.files[0];
        if (!file || file.type !== 'application/pdf') return;

        uploadBtn.style.display = 'none';
        loadingState.style.display = 'block';

        try {
            const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;

            const { error: uploadError } = await supabase.storage
                .from('flipbooks')
                .upload(fileName, file);

            if (uploadError) throw new Error('Storage transfer failed.');

            const { data: publicUrlData } = supabase.storage
                .from('flipbooks')
                .getPublicUrl(fileName);

            const fileUrl = publicUrlData.publicUrl;

            // Save to DB and instantly return the newly generated UUID
            const { data: insertData, error: dbError } = await supabase
                .from('pdf_documents')
                .insert([{ title: file.name, file_url: fileUrl }])
                .select('id')
                .single();

            if (dbError) throw new Error('Database registry failed.');

            // Generate the shareable URL and update the UI
            const shareableLink = `${window.location.origin}${window.location.pathname}?book=${insertData.id}`;
            shareUrlInput.value = shareableLink;
            shareCard.style.display = 'block';

            await buildRenderPipeline(fileUrl);

        } catch (error) {
            alert(error.message);
            console.error(error);
            uploadBtn.style.display = 'block';
            loadingState.style.display = 'none';
        }
    });

    copyBtn.addEventListener('click', () => {
        shareUrlInput.select();
        document.execCommand('copy');
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = 'Copy', 2000);
    });

    // RENDERING ENGINE
    async function buildRenderPipeline(url) {
        uploadCard.style.display = 'none';
        bookWrapper.style.display = 'flex';
        
        const pdf = await pdfjsLib.getDocument(url).promise;
        const totalPages = pdf.numPages;

        flipBook.innerHTML = '';

        for (let i = 1; i <= totalPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({ canvasContext: ctx, viewport: viewport }).promise;

            const pageDiv = document.createElement('div');
            pageDiv.className = 'page';
            pageDiv.appendChild(canvas);
            flipBook.appendChild(pageDiv);
        }

        const pageFlip = new St.PageFlip(flipBook, {
            width: 550,
            height: 733,
            size: 'stretch',
            minWidth: 315,
            maxWidth: 1000,
            minHeight: 420,
            maxHeight: 1350,
            drawShadow: true,
            showCover: true,
            mobileScrollSupport: false,
            maxShadowOpacity: 0.5
        });

        pageFlip.loadFromHTML(document.querySelectorAll('.page'));
    }
});
