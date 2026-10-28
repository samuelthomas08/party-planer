package app.partyplaner.logging;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.ThrowableProxyUtil;
import ch.qos.logback.core.AppenderBase;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Keeps the most recent log lines in memory and fans new ones out to live subscribers (the admin "live log").
 * Registered as a Logback appender on the root logger, so it sees everything the console sees.
 */
@Component
public class LogBuffer extends AppenderBase<ILoggingEvent> {

    private static final int CAPACITY = 3000;
    private static final int MAX_STACK = 6000;

    private final ArrayDeque<LogEntry> entries = new ArrayDeque<>(CAPACITY);
    private final List<Consumer<LogEntry>> listeners = new CopyOnWriteArrayList<>();
    private long seq;

    /** Registers this buffer as a Logback appender on the root logger. */
    @PostConstruct
    void attach() {
        LoggerContext context = (LoggerContext) LoggerFactory.getILoggerFactory();
        setContext(context);
        setName("LIVE_LOG_BUFFER");
        start();
        ((Logger) LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME)).addAppender(this);
    }

    /** Unregisters the appender. */
    @PreDestroy
    void detach() {
        ((Logger) LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME)).detachAppender(this);
        stop();
    }

    /** Stores the event and notifies live subscribers. */
    @Override
    protected void append(ILoggingEvent event) {
        Map<String, String> mdc = event.getMDCPropertyMap();
        String stack = event.getThrowableProxy() == null ? null : ThrowableProxyUtil.asString(event.getThrowableProxy());
        if (stack != null && stack.length() > MAX_STACK) {
            stack = stack.substring(0, MAX_STACK) + "\n… (truncated)";
        }
        LogEntry entry;
        synchronized (entries) {
            entry = new LogEntry(++seq, Instant.ofEpochMilli(event.getTimeStamp()), event.getLevel().toString(),
                    event.getLoggerName(), event.getThreadName(), event.getFormattedMessage(),
                    mdc.get("requestId"), mdc.get("user"), stack);
            if (entries.size() == CAPACITY) {
                entries.removeFirst();
            }
            entries.addLast(entry);
        }
        for (Consumer<LogEntry> listener : listeners) {
            listener.accept(entry);
        }
    }

    /** The newest {@code limit} entries with a sequence number above {@code after}, oldest first. */
    public List<LogEntry> snapshot(long after, int limit) {
        List<LogEntry> result = new ArrayList<>();
        synchronized (entries) {
            for (LogEntry e : entries) {
                if (e.seq() > after) {
                    result.add(e);
                }
            }
        }
        return result.size() > limit ? result.subList(result.size() - limit, result.size()) : result;
    }

    /** Receives every new entry (used by the SSE stream). */
    public void subscribe(Consumer<LogEntry> listener) {
        listeners.add(listener);
    }

    /** Stops receiving entries. */
    public void unsubscribe(Consumer<LogEntry> listener) {
        listeners.remove(listener);
    }
}
