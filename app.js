document.addEventListener('DOMContentLoaded', () => {
    const SUPABASE_URL = 'https://hxdagxcknmufpqoywmdn.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_QAGi1O6Vugv3jk7Bn6NcdQ_wtKj6OyF';

    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('file-input');
    const uploadCard = document.getElementById('upload-card');
    const loadingState = document.getElementById('loading-state');
    const bookWrapper = document.getElementById('book-wrapper');
    const flipBook = document.getElementById('flip-book');

    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', async (event) => {
        if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_URL === '') {
            alert('Backend connection missing. Please configure your Supabase credentials in the JavaScript file.');
            return;
        }

        const file = event.target.files[0];
        if (!file || file.type !== 'application/pdf') return;

        uploadBtn.style.display = 'none';
        loadingState.style.display = 'block';

        try {
            const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;

            const { error: uploadError } = await supabase.storage
                .from('flipbooks')
                .upload(fileName, file);

            if (uploadError) {
                alert('Storage transfer failed. Check bucket permissions.');
                uploadBtn.style.display = 'block';
                loadingState.style.display = 'none';
                return;
            }

            const { data: publicUrlData } = supabase.storage
                .from('flipbooks')
                .getPublicUrl(fileName);

            const fileUrl = publicUrlData.publicUrl;

            await supabase
                .from('pdf_documents')
                .insert([{ title: file.name, file_url: fileUrl }]);

            await buildRenderPipeline(fileUrl, supabase);
        } catch (error) {
            alert('A network or parsing error occurred. Check the developer console for traces.');
            console.error(error);
            uploadBtn.style.display = 'block';
            loadingState.style.display = 'none';
        }
    });

    async function buildRenderPipeline(url, supabaseClient) {
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

        uploadCard.style.display = 'none';
        bookWrapper.style.display = 'flex';

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
