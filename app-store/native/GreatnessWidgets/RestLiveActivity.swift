// Le repos qui défile dans la Dynamic Island et sur l'écran verrouillé, sans que l'app ait besoin de tourner :
// le compte à rebours est calculé par le système (Text(timerInterval:)). À la fin, « C'est reparti ! ».
// Avec de la musique : la pochette et le titre du morceau, et l'accent de l'app (aux couleurs du morceau).
import ActivityKit
import WidgetKit
import SwiftUI
import UIKit

private let accent = Color(red: 0.91, green: 0.16, blue: 0.23)

// « #rrggbb » → couleur (l'accent par défaut sinon)
private func tintColor(_ hex: String?) -> Color {
    guard let hex = hex, hex.hasPrefix("#"), hex.count == 7, let v = UInt32(hex.dropFirst(), radix: 16) else { return accent }
    return Color(red: Double((v >> 16) & 0xff) / 255, green: Double((v >> 8) & 0xff) / 255, blue: Double(v & 0xff) / 255)
}

// La pochette déposée par l'app dans le dossier partagé
private func coverImage(_ name: String?) -> UIImage? {
    guard let name = name, let url = SharedArt.url(name) else { return nil }
    return UIImage(contentsOfFile: url.path)
}

struct RestLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestAttributes.self) { context in
            RestLockView(state: context.state, over: context.isStale)
                .activityBackgroundTint(Color.black.opacity(0.82))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            let tint = tintColor(context.state.tint)
            let cover = coverImage(context.state.art)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label("Repos", systemImage: "timer").font(.caption.bold()).foregroundStyle(tint)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if context.isStale {
                        Text("Go !").font(.title3.bold()).foregroundStyle(tint)
                    } else {
                        Text(timerInterval: context.state.start...context.state.end, countsDown: true)
                            .font(.title2.monospacedDigit().bold()).multilineTextAlignment(.trailing).frame(maxWidth: 92)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        if !context.isStale {
                            ProgressView(timerInterval: context.state.start...context.state.end, countsDown: true, label: { EmptyView() }, currentValueLabel: { EmptyView() })
                                .tint(tint)
                        }
                        Text(context.isStale ? "C'est reparti : \(context.state.title)" : "Ensuite : \(context.state.title)").font(.subheadline.bold()).lineLimit(1)
                        if !context.state.detail.isEmpty {
                            Text(context.state.detail).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                        }
                        if let song = context.state.song {
                            SongLine(song: song, cover: cover, size: 22)
                        }
                    }
                }
            } compactLeading: {
                if let cover = cover {
                    Image(uiImage: cover).resizable().scaledToFill().frame(width: 22, height: 22).clipShape(Circle())
                } else {
                    Image(systemName: "timer").foregroundStyle(tint)
                }
            } compactTrailing: {
                if context.isStale {
                    Text("Go").font(.caption.bold()).foregroundStyle(tint)
                } else {
                    Text(timerInterval: context.state.start...context.state.end, countsDown: true)
                        .monospacedDigit().font(.caption.bold()).frame(maxWidth: 44)
                }
            } minimal: {
                if context.isStale {
                    Image(systemName: "bolt.fill").foregroundStyle(tint)
                } else {
                    Text(timerInterval: context.state.start...context.state.end, countsDown: true)
                        .monospacedDigit().font(.caption2.bold()).frame(maxWidth: 36)
                }
            }
            .keylineTint(tint)
        }
    }
}

// Le morceau qui joue : sa pochette (si l'app a pu la déposer) et « Titre · Artiste »
struct SongLine: View {
    let song: String
    let cover: UIImage?
    let size: CGFloat
    var body: some View {
        HStack(spacing: 6) {
            if let cover = cover {
                Image(uiImage: cover).resizable().scaledToFill().frame(width: size, height: size).clipShape(RoundedRectangle(cornerRadius: 5))
            } else {
                Image(systemName: "music.note").font(.caption2)
            }
            Text(song).font(.caption2).lineLimit(1)
        }
        .foregroundStyle(.white.opacity(0.72))
    }
}

struct RestLockView: View {
    let state: RestAttributes.ContentState
    let over: Bool
    var body: some View {
        let tint = tintColor(state.tint)
        let cover = coverImage(state.art)
        HStack(spacing: 14) {
            ZStack {
                if let cover = cover {
                    Image(uiImage: cover).resizable().scaledToFill().frame(width: 48, height: 48).clipShape(RoundedRectangle(cornerRadius: 12))
                } else {
                    Circle().fill(tint.opacity(0.2))
                    Image(systemName: over ? "bolt.fill" : "timer").font(.title2.bold()).foregroundStyle(tint)
                }
            }
            .frame(width: 48, height: 48)
            VStack(alignment: .leading, spacing: 4) {
                Text(over ? "C'est reparti : \(state.title)" : "Repos · ensuite \(state.title)").font(.subheadline.bold()).foregroundStyle(.white).lineLimit(1)
                if !state.detail.isEmpty {
                    Text(state.detail).font(.caption).foregroundStyle(.white.opacity(0.72)).lineLimit(1)
                }
                if let song = state.song {
                    SongLine(song: song, cover: nil, size: 0)
                }
                if !over {
                    ProgressView(timerInterval: state.start...state.end, countsDown: true, label: { EmptyView() }, currentValueLabel: { EmptyView() })
                        .tint(tint)
                }
            }
            Spacer(minLength: 0)
            if over {
                Text("Go !").font(.system(size: 28, weight: .heavy, design: .rounded)).foregroundStyle(tint)
            } else {
                Text(timerInterval: state.start...state.end, countsDown: true)
                    .font(.system(size: 30, weight: .bold, design: .rounded).monospacedDigit())
                    .foregroundStyle(.white).multilineTextAlignment(.trailing).frame(width: 86, alignment: .trailing)
            }
        }
        .padding(16)
    }
}
