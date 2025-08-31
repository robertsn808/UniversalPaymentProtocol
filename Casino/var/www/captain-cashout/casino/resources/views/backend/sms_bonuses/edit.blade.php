@extends('backend.layouts.app')

@section('page-title', trans('app.edit_sms_bonus'))
@section('page-heading', $sms_bonus->id)

@section('content')

<section class="content-header">
	@include('backend.partials.messages')
</section>

<section class="content">

	<form action="{{ route('backend.sms_bonus.update', $sms_bonus->id) }}" method="POST" enctype="multipart/form-data" id="user-form">
		@csrf
		<div class="box box-default">
			<div class="box-header with-border">
				<h3 class="box-title">@lang('app.sms_bonus_details')</h3>
			</div>

			<div class="box-body">
				<div class="row">

					@include('backend.sms_bonuses.partials.base', ['edit' => true])

				</div>
			</div>

			<div class="box-footer">
				<button type="submit" class="btn btn-primary">
					@lang('app.edit_sms_bonus')
				</button>
				<a href="{{ route('backend.sms_bonus.delete', $sms_bonus->id) }}" class="btn btn-danger" data-method="DELETE" data-confirm-title="@lang('app.please_confirm')" data-confirm-text="@lang('app.are_you_sure_delete_sms_bonus')" data-confirm-delete="@lang('app.yes_delete_him')">
					@lang('app.delete_sms_bonus')
				</a>
			</div>
		</div>
	</form>

</section>

@stop

@section('scripts')
<script>

</script>
@stop