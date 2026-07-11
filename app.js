document.addEventListener('DOMContentLoaded', async () => {
    const SUPABASE_URL = 'https://hxdagxcknmufpqoywmdn.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_QAGi1O6Vugv3jk7Bn6NcdQ_wtKj6OyF';
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('file-input');
    const uploadCard = document.getElementById('upload-card');
    const loadingState = document.getElementById('loading-state');
    const bookWrapper = document.getElementById('book-wrapper');
    const flipBook = document.getElementById('flip-book');
    const shareCard = document.getElementById('share-card');
    const shareUrlInput = document.getElementById('share-url');
    const copyBtn = document.getElementById('copy-btn');
    
    const mobileNav = document.getElementById('mobile-nav');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const pageCounter = document.getElementById('page-counter');

    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

    let supabase;
    if (SUPABASE_URL && SUPABASE_URL.startsWith('http')) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get('book');

    if (bookId && supabase) {
        try {
            const { data: documentData, error } = await supabase
                .from('pdf_documents')
                .select('file_url')
                .eq('id', bookId)
                .single();

            if (documentData && !error) {
                uploadCard.style.display = 'none';
                await buildRenderPipeline(documentData.file_url);
                return;
            } else {
                alert('Document not found or link has expired.');
            }
        } catch (err) {
            console.error(err);
        }
    }

    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', async (event) => {
        if (!supabase) {
            alert('Backend connection missing.');
            return;
        }

        const file = event.target.files[0];
        if (!file || file.type !== 'application/pdf') return;

        uploadBtn.style.display = 'none';
        loadingState.style.display = 'flex';

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

            const { data: insertData, error: dbError } = await supabase
                .from('pdf_documents')
                .insert([{ title: file.name, file_url: fileUrl }])
                .select('id')
                .single();

            if (dbError) throw new Error('Database registry failed.');

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

    async function buildRenderPipeline(url) {
        uploadCard.style.display = 'none';
        loadingState.style.display = 'none';
        bookWrapper.style.display = 'flex';
        
        // Trigger Immersive Reading Mode to maximize screen space
        document.body.classList.add('reading-mode');
        
        const pdf = await pdfjsLib.getDocument(url).promise;
        const totalPages = pdf.numPages;

        flipBook.innerHTML = '';

        const pixelRatio = window.devicePixelRatio || 2.0;
        let baseWidth = 550;
        let baseHeight = 733;

        for (let i = 1; i <= totalPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: pixelRatio });
            
            if (i === 1) {
                const unscaledViewport = page.getViewport({ scale: 1.0 });
                baseWidth = unscaledViewport.width;
                baseHeight = unscaledViewport.height;
            }

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

        mobileNav.style.display = 'flex';

        const pageFlip = new St.PageFlip(flipBook, {
            width: baseWidth,
            height: baseHeight,
            size: 'stretch',
            minWidth: 100,
            maxWidth: 5000, 
            minHeight: 100,
            maxHeight: 5000,
            drawShadow: true,
            showCover: true,
            usePortrait: true,
            mobileScrollSupport: true,
            swipeDistance: 10,
            flippingTime: 700,
            maxShadowOpacity: 0.3
        });

        pageFlip.loadFromHTML(document.querySelectorAll('.page'));

        prevBtn.addEventListener('click', () => {
            pageFlip.flipPrev();
        });

        nextBtn.addEventListener('click', () => {
            pageFlip.flipNext();
        });

        pageFlip.on('flip', (e) => {
            pageCounter.textContent = `Page ${e.data + 1} of ${totalPages}`;
        });
    }
});
