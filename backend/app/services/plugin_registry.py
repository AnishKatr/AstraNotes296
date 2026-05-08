"""FR-02: extensible note types. Only registered handlers may be used."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.services.secure_note_handler import NoteTypeHandler, SecureNoteHandler


@dataclass(frozen=True)
class NoteTypeSpec:
    """Metadata and behaviour for a registered note type."""

    type_id: str
    handler: NoteTypeHandler = field(default_factory=NoteTypeHandler)


class PluginRegistry:
    """Maps ``note_type`` strings to registration entries."""

    def __init__(self) -> None:
        self._types: dict[str, NoteTypeSpec] = {}
        self._register_defaults()

    def _register_defaults(self) -> None:
        self.register("text", NoteTypeSpec(type_id="text"))
        # Voice uses the passthrough handler; full recording support is Phase 6.
        self.register("voice", NoteTypeSpec(type_id="voice"))
        self.register("secure", NoteTypeSpec(type_id="secure", handler=SecureNoteHandler()))

    def register(self, type_id: str, spec: NoteTypeSpec) -> None:
        self._types[type_id] = spec

    def is_registered(self, type_id: str) -> bool:
        return type_id in self._types

    def validate_type_or_raise(self, type_id: str) -> None:
        if not self.is_registered(type_id):
            raise ValueError(f"Unregistered note type: {type_id!r}")

    def get_handler(self, type_id: str) -> NoteTypeHandler:
        spec = self._types.get(type_id)
        if spec is None:
            return NoteTypeHandler()
        return spec.handler


_registry = PluginRegistry()


def get_plugin_registry() -> PluginRegistry:
    return _registry
