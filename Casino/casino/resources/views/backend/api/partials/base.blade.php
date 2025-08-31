<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.api_key') <small><a href="javascript:;" id="generateKey">@lang('app.generate')</a></small></label>
		<input type="text" class="form-control" id="keygen" name="keygen" required value="{{ $edit ? $api->keygen : '' }}">
	</div>
</div>

<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.api_ip')</label>
		<input type="text" class="form-control" id="ip" name="ip" value="{{ $edit ? $api->ip : '' }}">
	</div>
</div>

<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.shops')</label>
		<select name="shop_id" class="form-control">
			@foreach($shops as $id => $name)
				<option value="{{ $id }}" {{ $edit && $api->shop_id == $id ? 'selected' : '' }}>{{ $name }}</option>
			@endforeach
		</select>
	</div>
</div>

<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.status')</label>
		<select name="status" class="form-control">
			<option value="0" {{ $edit && $api->status == 0 ? 'selected' : '' }}>Disabled</option>
			<option value="1" {{ $edit && $api->status == 1 ? 'selected' : '' }}>Active</option>
		</select>
	</div>
</div>