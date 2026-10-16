// Le repos qui défile dans la Dynamic Island et sur l'écran verrouillé, sans que l'app ait besoin de tourner :
// le compte à rebours est calculé par le système (Text(timerInterval:)). À la fin, « C'est reparti ! ».
import ActivityKit
import WidgetKit
import SwiftUI

private let accent = Color(red: 0.91, green: 0.16, blue: 0.23)

struct RestLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestAttributes.self) { context in
            RestLockView(state: context.state, over: context.isStale)
                .activityBackgroundTint(Color.black.opacity(0.82))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label("Repos", systemImage: "timer").font(.caption.bold()).foregroundStyle(accent)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if context.isStale {
                        Text("Go !").font(.title3.bold()).foregroundStyle(accent)
                    } else {
                        Text(timerInterval: context.state.start...context.state.end, countsDown: true)
                            .font(.title2.monospacedDigit().bold()).multilineTextAlignment(.trailing).frame(maxWidth: 92)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        if !context.isStale {
                            ProgressView(timerInterval: context.state.start...context.state.end, countsDown: true, label: { EmptyView() }, currentValueLabel: { EmptyView() })
                                .tint(accent)
                        }
                        Text(context.isStale ? "C'est reparti : \(context.state.title)" : "Ensuite : \(context.state.title)").font(.subheadline.bold()).lineLimit(1)
                        if !context.state.detail.isEmpty {
                            Text(context.state.detail).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: "timer").foregroundStyle(accent)
            } compactTrailing: {
                if context.isStale {
                    Text("Go").font(.caption.bold()).foregroundStyle(accent)
                } else {
                    Text(timerInterval: context.state.start...context.state.end, countsDown: true)
                        .monospacedDigit().font(.caption.bold()).frame(maxWidth: 44)
                }
            } minimal: {
                if context.isStale {
                    Image(systemName: "bolt.fill").foregroundStyle(accent)
                } else {
                    Text(timerInterval: context.state.start...context.state.end, countsDown: true)
                        .monospacedDigit().font(.caption2.bold()).frame(maxWidth: 36)
                }
            }
            .keylineTint(accent)
        }
    }
}

struct RestLockView: View {
    let state: RestAttributes.ContentState
    let over: Bool
    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(accent.opacity(0.2))
                Image(systemName: over ? "bolt.fill" : "timer").font(.title2.bold()).foregroundStyle(accent)
            }
            .frame(width: 48, height: 48)
            VStack(alignment: .leading, spacing: 4) {
                Text(over ? "C'est reparti : \(state.title)" : "Repos · ensuite \(state.title)").font(.subheadline.bold()).foregroundStyle(.white).lineLimit(1)
                if !state.detail.isEmpty {
                    Text(state.detail).font(.caption).foregroundStyle(.white.opacity(0.72)).lineLimit(1)
                }
                if !over {
                    ProgressView(timerInterval: state.start...state.end, countsDown: true, label: { EmptyView() }, currentValueLabel: { EmptyView() })
                        .tint(accent)
                }
            }
            Spacer(minLength: 0)
            if over {
                Text("Go !").font(.system(size: 28, weight: .heavy, design: .rounded)).foregroundStyle(accent)
            } else {
                Text(timerInterval: state.start...state.end, countsDown: true)
                    .font(.system(size: 30, weight: .bold, design: .rounded).monospacedDigit())
                    .foregroundStyle(.white).multilineTextAlignment(.trailing).frame(width: 86, alignment: .trailing)
            }
        }
        .padding(16)
    }
}
