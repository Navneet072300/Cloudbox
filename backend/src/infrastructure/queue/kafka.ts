import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';
import { logger } from '../../utils/logger';

const kafka = new Kafka({
  clientId: 'dropbox-backend',
  brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
  logLevel: logLevel.WARN,
  retry: {
    initialRetryTime: 300,
    retries: 5,
  },
});

export const producer: Producer = kafka.producer({
  allowAutoTopicCreation: true,
  transactionTimeout: 30000,
});

export const consumer: Consumer = kafka.consumer({
  groupId: 'dropbox-sync-group',
  allowAutoTopicCreation: true,
});

export async function connectKafka(): Promise<void> {
  // Connect in background so the HTTP server starts regardless of Kafka availability.
  // KafkaJS will automatically reconnect once brokers come up.
  producer.connect().catch(err => logger.warn({ err }, 'Kafka producer connect failed — retrying in background'));
  consumer.connect().catch(err => logger.warn({ err }, 'Kafka consumer connect failed — retrying in background'));
}

export async function disconnectKafka(): Promise<void> {
  await producer.disconnect();
  await consumer.disconnect();
}

export async function publishEvent(topic: string, key: string, payload: object): Promise<void> {
  try {
    await producer.send({
      topic,
      messages: [{ key, value: JSON.stringify(payload) }],
    });
  } catch (err) {
    logger.error({ err, topic, key }, 'Failed to publish Kafka event');
  }
}
