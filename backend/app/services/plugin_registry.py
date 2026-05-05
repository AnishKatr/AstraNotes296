"""FR-02: extensible note types. Only registered handlers may be used."""

from __future__ import annotations

from dataclasses import dataclass
@dataclass(frozen=True)
class NoteTypeSpec:
    """Metadata for a registered note type (handlers added per tier)."""

    type_id: str


class PluginRegistry:
    """Maps ``note_type`` strings to registration entries."""

    def __init__(self) -> None:
        self._types: dict[str, NoteTypeSpec] = {}
        self._register_defaults()

    def _register_defaults(self) -> None:
        self.register("text", NoteTypeSpec(type_id="text"))

    def register(self, type_id: str, spec: NoteTypeSpec) -> None:
        self._types[type_id] = spec

    def is_registered(self, type_id: str) -> bool:
        return type_id in self._types

    def validate_type_or_raise(self, type_id: str) -> None:
        if not self.is_registered(type_id):
            raise ValueError(f"Unregistered note type: {type_id!r}")


_registry = PluginRegistry()


def get_plugin_registry() -> PluginRegistry:
    return _registry
