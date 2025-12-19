import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class MessageGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('joinConversation')
  join(@MessageBody() data: { conversationId: number }) {
    const room = `conversation-${data.conversationId}`;
    return { room };
  }

  sendNewMessage(conversationId: number, message: any) {
    this.server.to(`conversation-${conversationId}`).emit('newMessage', message);
  }
}
