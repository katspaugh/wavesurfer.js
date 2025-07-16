export function makeDraggable(element, onDrag, onStart, onEnd, wavesurfer, threshold = 3, mouseButton = 0, touchDelay = 100) {
    if (!element)
        return () => void 0;
    const isTouchDevice = matchMedia('(pointer: coarse)').matches;
    let unsubscribeDocument = () => void 0;
    const onPointerDown = (event) => {
        var _a;
        if (event.button !== mouseButton)
            return;
        event.preventDefault();
        event.stopPropagation();
        let startX = event.clientX;
        let startY = event.clientY;
        let lastX = event.clientX;
        let lastScroll = (_a = wavesurfer === null || wavesurfer === void 0 ? void 0 : wavesurfer.getScroll()) !== null && _a !== void 0 ? _a : 0;
        let isDragging = false;
        const touchStartTime = Date.now();
        const scrollContainer = wavesurfer === null || wavesurfer === void 0 ? void 0 : wavesurfer.getWrapper().parentElement;
        const onPointerMove = (event) => {
            var _a;
            event.preventDefault();
            event.stopPropagation();
            if (isTouchDevice && Date.now() - touchStartTime < touchDelay)
                return;
            const x = event.clientX;
            const y = event.clientY;
            const currentScroll = (_a = wavesurfer === null || wavesurfer === void 0 ? void 0 : wavesurfer.getScroll()) !== null && _a !== void 0 ? _a : 0;
            const scrollDiff = currentScroll - lastScroll;
            lastScroll = currentScroll;
            const dx = x + scrollDiff - startX;
            const dy = y - startY;
            lastX = x;
            if (isDragging || Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
                const rect = element.getBoundingClientRect();
                const { left, top } = rect;
                if (!isDragging) {
                    onStart === null || onStart === void 0 ? void 0 : onStart(startX - left, startY - top);
                    isDragging = true;
                }
                onDrag(dx, dy, x - left, y - top);
                startX = x;
                startY = y;
            }
        };
        const onPointerUp = (event) => {
            if (isDragging) {
                const x = event.clientX;
                const y = event.clientY;
                const rect = element.getBoundingClientRect();
                const { left, top } = rect;
                onEnd === null || onEnd === void 0 ? void 0 : onEnd(x - left, y - top);
            }
            unsubscribeDocument();
        };
        const onClick = (event) => {
            if (isDragging) {
                event.stopPropagation();
                event.preventDefault();
            }
        };
        const onTouchMove = (event) => {
            if (isDragging) {
                event.preventDefault();
            }
        };
        const onScroll = () => {
            if (!isDragging || !wavesurfer) {
                return;
            }
            const currentScroll = wavesurfer.getScroll();
            const scrollDiff = currentScroll - lastScroll;
            lastScroll = currentScroll;
            const { left } = element.getBoundingClientRect();
            onDrag(scrollDiff, 0, lastX - left, 0);
        };
        if (!scrollContainer) {
            return;
        }
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('click', onClick, { capture: true });
        wavesurfer === null || wavesurfer === void 0 ? void 0 : wavesurfer.on('scroll', onScroll);
        unsubscribeDocument = () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            document.removeEventListener('touchmove', onTouchMove);
            wavesurfer === null || wavesurfer === void 0 ? void 0 : wavesurfer.un('scroll', onScroll);
            setTimeout(() => {
                document.removeEventListener('click', onClick, { capture: true });
            }, 10);
        };
    };
    element.addEventListener('pointerdown', onPointerDown);
    return () => {
        unsubscribeDocument();
        element.removeEventListener('pointerdown', onPointerDown);
    };
}
