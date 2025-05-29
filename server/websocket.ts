import { Server as SocketIOServer } from 'socket.io';
import type { Server } from 'http';
import type { Episode } from '@shared/schema';

export interface ProcessingUpdate extends Partial<Episode> {
  episodeId: number;
  timestamp?: string;
}

export class WebSocketService {
  private io: SocketIOServer;
  
  constructor(httpServer: Server) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });
    
    this.setupEventHandlers();
    console.log('WebSocket service initialized');
  }
  
  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      
      // Join episode-specific rooms for targeted updates
      socket.on('subscribe-episode', (episodeId: number) => {
        socket.join(`episode-${episodeId}`);
        console.log(`Client ${socket.id} subscribed to episode ${episodeId}`);
      });
      
      socket.on('unsubscribe-episode', (episodeId: number) => {
        socket.leave(`episode-${episodeId}`);
        console.log(`Client ${socket.id} unsubscribed from episode ${episodeId}`);
      });
      
      // Join general updates room
      socket.on('subscribe-system', () => {
        socket.join('system-updates');
        console.log(`Client ${socket.id} subscribed to system updates`);
      });
      
      socket.on('unsubscribe-system', () => {
        socket.leave('system-updates');
        console.log(`Client ${socket.id} unsubscribed from system updates`);
      });
      
      socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
      });
      
      socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
      });
    });
  }
  
  // Emit processing status updates to specific episode subscribers
  emitProcessingUpdate(episodeId: number, update: Partial<Episode>) {
    const updateData: ProcessingUpdate = {
      episodeId,
      ...update,
      timestamp: new Date().toISOString()
    };
    
    console.log(`Emitting processing update for episode ${episodeId}:`, updateData);
    this.io.to(`episode-${episodeId}`).emit('processing-update', updateData);
  }
  
  // Emit general system updates (queue changes, new episodes, etc.)
  emitSystemUpdate(event: string, data: any) {
    console.log(`Emitting system update: ${event}`, data);
    this.io.to('system-updates').emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }
  
  // Emit queue status updates
  emitQueueUpdate(queueData: any) {
    this.emitSystemUpdate('queue-updated', queueData);
  }
  
  // Emit stats updates
  emitStatsUpdate(statsData: any) {
    this.emitSystemUpdate('stats-updated', statsData);
  }
  
  // Get connected clients count
  getConnectedClientsCount(): number {
    return this.io.sockets.sockets.size;
  }
  
  // Get clients subscribed to specific episode
  getEpisodeSubscribersCount(episodeId: number): number {
    const room = this.io.sockets.adapter.rooms.get(`episode-${episodeId}`);
    return room ? room.size : 0;
  }
} 