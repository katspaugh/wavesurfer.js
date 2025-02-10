import WebAudioPlayer from '../src/webaudio';

describe('WebAudioPlayer', () => {
    let player;
    let mockAudioContext;
    let mockBufferNode;
    let mockGainNode;
    
    beforeEach(() => {
        mockBufferNode = {
            buffer: null,
            connect: jest.fn(),
            disconnect: jest.fn(),
            start: jest.fn(),
            stop: jest.fn(),
            playbackRate: { value: 1 },
            onended: null,
        };
        
        mockGainNode = {
            connect: jest.fn(),
            gain: { value: 1 },
        };
        
        mockAudioContext = {
            currentTime: 0,
            createBufferSource: jest.fn().mockReturnValue(mockBufferNode),
            createGain: jest.fn().mockReturnValue(mockGainNode),
            destination: {},
        };
        
        player = new WebAudioPlayer(mockAudioContext)
        
        // Set up a buffer to enable playback
        const mockBuffer = { duration: 10 }
        ;(player as any).buffer = mockBuffer })
        
        describe('_play method', () => { it('should reset position when currentPos is negative', async () => {
            // Set up negative position
            player.playbackRate = -1;
            player.currentTime = 5;
            
            // Trigger _play through play()
            await player.play();
            
            // Verify position was reset
            expect(player.currentTime).toBe(0);
            expect(mockBufferNode.start).toHaveBeenCalledWith(0, 0)
        })
        
        it('should reset position when currentPos exceeds duration', async () => {
            // Set position beyond duration
            player.currentTime = 15;
            await player.play();
            
            // Verify position was reset
            expect(player.currentTime).toBe(0);
            expect(mockBufferNode.start).toHaveBeenCalledWith(0, 0);
        })
        
        it('should maintain position when within valid range', async () => {
            const validTime = 5;
            player.currentTime = validTime;
            await player.play()
            
            // Verify position was maintained
            expect(mockBufferNode.start).toHaveBeenCalledWith(0, validTime);
        })
        
        it('should handle playback rate changes correctly', async () => {
            player.currentTime = 2;
            player.playbackRate = 2;
            await player.play()
            
            // currentPos should be 4 (2 * 2)
            expect(mockBufferNode.start).toHaveBeenCalledWith(0, 4);
            expect(mockBufferNode.playbackRate.value).toBe(2);
        })
    }) 
})